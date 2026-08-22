import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ParseUUIDPipe, Type } from '@nestjs/common';
import { RolesAdminController } from '../../modules/access-control/roles.admin.controller';
import { UsersAdminController } from '../../modules/access-control/users.admin.controller';
import { ArticlesAdminController } from '../../modules/articles/articles.admin.controller';
import { ArticlesController } from '../../modules/articles/articles.controller';
import { MessagesAdminController } from '../../modules/contact/messages.admin.controller';
import { ExperiencesAdminController } from '../../modules/experiences/experiences.admin.controller';
import { MediaAdminController } from '../../modules/media/media.admin.controller';
import { PreviewAdminController } from '../../modules/preview/preview.admin.controller';
import { PreviewController } from '../../modules/preview/preview.controller';
import { ProjectsAdminController } from '../../modules/projects/projects.admin.controller';
import { ProjectsController } from '../../modules/projects/projects.controller';
import { SeoAdminController } from '../../modules/seo/seo.admin.controller';
import { SeoController } from '../../modules/seo/seo.controller';
import { SkillsAdminController } from '../../modules/skills/skills.admin.controller';
import { CategoriesAdminController } from '../../modules/taxonomy/categories.admin.controller';
import { TagsAdminController } from '../../modules/taxonomy/tags.admin.controller';
import { TestimonialsAdminController } from '../../modules/testimonials/testimonials.admin.controller';

/**
 * A malformed `:id` answers **400** — a status no request body or query explains, and one a
 * client can hit on every one of these routes. The global `ValidationPipe` actually runs first
 * (Nest orders global pipes ahead of param-bound ones) but no-ops on a primitive route parameter,
 * so `ParseUUIDPipe` is what decides. See `src/modules/README.md` for the full layer order.
 *
 * Owner policy, in both directions:
 *
 *   1. a route that can deterministically return 400 because its declared path parameter is parsed
 *      by the standard `ParseUUIDPipe` MUST document that 400 (per-handler, not folded into the
 *      class-level `ApiAdminErrorResponses()`);
 *   2. the malformed-UUID declaration must appear ONLY where that pipe actually runs. A non-UUID
 *      route may still legitimately document some OTHER 400 for an unrelated deterministic cause
 *      (`PATCH /admin/seo/pages/{pageKey}` documents one for locale handling) — the invariant
 *      forbids the UUID-specific cause, not the status.
 *
 * Direction 2 is enforced DOCUMENT-WIDE: every operation in the generated `openapi.json` is
 * scanned for the UUID-specific wording, so a misapplied helper on a controller with no route
 * parameters — outside the census below entirely — is still caught. Only direction 1 depends on
 * the controller census.
 *
 * The two sides are read from independent places on purpose:
 *
 *   - the RUNTIME side from Nest's `__routeArguments__` metadata — the pipe list the framework
 *     will actually run, reflected off the controller class;
 *   - the CONTRACT side from the generated `openapi.json` — the published document, not the
 *     decorator source that produced it.
 *
 * Reading the contract side from the decorators instead would make both sides the same file, and
 * the test could not detect divergence in either direction.
 */

// Every controller that declares at least one route parameter — verified by scanning
// `src/**/*.controller.ts` for `@Param(`. This census serves the RUNTIME side: discovering every
// route that could carry `ParseUUIDPipe`, so the positive invariant cannot miss one. It does NOT
// bound the reverse invariant, which reads the whole generated document.
// `PreviewController` is included even though it is `@Public()`: its 400 is a published contract
// like any other.
const CONTROLLERS: Type[] = [
  ArticlesAdminController,
  ArticlesController,
  CategoriesAdminController,
  ExperiencesAdminController,
  MediaAdminController,
  MessagesAdminController,
  PreviewAdminController,
  PreviewController,
  ProjectsAdminController,
  ProjectsController,
  RolesAdminController,
  SeoAdminController,
  SeoController,
  SkillsAdminController,
  TagsAdminController,
  TestimonialsAdminController,
  UsersAdminController,
];

// The stable semantic marker of the UUID-specific 400: `ApiUuidParamBadRequest` renders every
// variant as "The <noun> id in the path is not a well-formed UUID." Matching this phrase against
// the GENERATED description is what keeps the reverse invariant cause-specific — a legitimate
// locale/validation 400 on a non-UUID route does not contain it and is not touched.
const UUID_400_DESCRIPTION_MARKER = 'not a well-formed UUID';

// Nest internals used for reflection. Both are stable and already relied on by
// `route-permissions.spec.ts`; `__routeArguments__` is additionally pinned by the
// non-empty assertion below, so a rename fails loudly instead of emptying the scan.
const ROUTE_ARGS_METADATA = '__routeArguments__';
const PATH_METADATA = 'path';
const METHOD_METADATA = 'method';

// `RequestMethod` as the metadata stores it (an enum index), mapped to the OpenAPI verb.
const HTTP_VERB = [
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'all',
  'options',
  'head',
];

const GLOBAL_PREFIX = '/api/v1';

interface RouteArgument {
  readonly index: number;
  readonly data?: unknown;
  readonly pipes?: unknown[];
}

interface Route {
  /** `MediaAdminController.remove` — for failure messages that name the defect. */
  readonly handler: string;
  /** `get` / `post` / … */
  readonly verb: string;
  /** `/api/v1/admin/media/{id}` — the OpenAPI path template. */
  readonly path: string;
  readonly parsesUuidParam: boolean;
}

function isParseUuidPipe(pipe: unknown): boolean {
  // Nest stores either the class (`ParseUUIDPipe`) or an instance (`new ParseUUIDPipe({…})`).
  return pipe === ParseUUIDPipe || pipe instanceof ParseUUIDPipe;
}

/** `admin/messages/:id/replies` → `/api/v1/admin/messages/{id}/replies` */
function toOpenApiPath(controllerPath: string, routePath: string): string {
  const segments = [GLOBAL_PREFIX, controllerPath, routePath]
    .filter((part) => part && part !== '/')
    .join('/');
  return `/${segments}`
    .replace(/\/+/g, '/')
    .replace(/:(\w+)/g, '{$1}')
    .replace(/\/$/, '');
}

function routesOf(controller: Type): Route[] {
  const controllerPath = Reflect.getMetadata(
    PATH_METADATA,
    controller,
  ) as string;
  const prototype = controller.prototype as Record<string, unknown>;

  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .filter((name) =>
      Reflect.hasMetadata(PATH_METADATA, prototype[name] as object),
    )
    .map((name) => {
      const handler = prototype[name] as object;
      const args =
        (Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, name) as Record<
          string,
          RouteArgument
        >) ?? {};
      const parsesUuidParam = Object.entries(args).some(
        ([key, argument]) =>
          // The key is `<paramtype>:<index>`; `5` is Nest's RouteParamtypes.PARAM. Verified
          // against the real metadata rather than read off the enum — `4` is QUERY, and using it
          // made every route look pipe-free while the suite still ran.
          key.startsWith('5:') &&
          typeof argument.data === 'string' &&
          (argument.pipes ?? []).some(isParseUuidPipe),
      );
      return {
        handler: `${controller.name}.${name}`,
        verb:
          HTTP_VERB[Reflect.getMetadata(METHOD_METADATA, handler) as number] ??
          'get',
        path: toOpenApiPath(
          controllerPath,
          Reflect.getMetadata(PATH_METADATA, handler) as string,
        ),
        parsesUuidParam,
      };
    });
}

interface OpenApiDocument {
  paths: Record<
    string,
    Record<string, { responses?: Record<string, { description?: string }> }>
  >;
}

function loadContract(): OpenApiDocument {
  return JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', 'openapi.json'), 'utf8'),
  ) as OpenApiDocument;
}

// Stable operation key shared by both sides of the equality (`GET /api/v1/locales`).
function operationKey(route: Route): string {
  return `${route.verb.toUpperCase()} ${route.path}`;
}

// Document-wide CONTRACT side: every operation in the generated document whose declared 400
// carries the malformed-UUID marker, regardless of which controller produced it. This scan
// deliberately never touches the controller census.
function documentedUuid400Operations(document: OpenApiDocument): string[] {
  const keys: string[] = [];
  for (const [path, node] of Object.entries(document.paths)) {
    for (const [verb, operation] of Object.entries(node)) {
      if (verb === 'parameters') continue;
      if (
        (operation.responses?.['400']?.description ?? '').includes(
          UUID_400_DESCRIPTION_MARKER,
        )
      ) {
        keys.push(`${verb.toUpperCase()} ${path}`);
      }
    }
  }
  return keys;
}

describe('every UUID-parsing route documents the 400 its pipe can produce', () => {
  const contract = loadContract();
  const routes = CONTROLLERS.flatMap(routesOf);
  const uuidRoutes = routes.filter((route) => route.parsesUuidParam);

  it('finds the routes at all, so the assertions below cannot pass vacuously', () => {
    // Pins the Nest reflection keys. If `__routeArguments__` or the PARAM paramtype index moves,
    // `parsesUuidParam` silently becomes false everywhere and every check below would pass while
    // testing nothing. The 35 is asserted, not merely recorded: adding or removing a
    // UUID-parsed route fails HERE first, which is the point.
    expect(uuidRoutes).toHaveLength(35);
    // Every scanned route — UUID or not — must resolve to a real operation in the generated
    // document; otherwise the reverse invariant's lookups would silently read `undefined`.
    for (const route of routes) {
      expect(contract.paths[route.path]?.[route.verb]).toBeDefined();
    }
  });

  it('declares the malformed-UUID 400 on EXACTLY the ParseUUIDPipe routes — document-wide', () => {
    // One exact set equality carries both directions of owner policy:
    //
    //   forward — every `ParseUUIDPipe` route publishes the malformed-UUID 400 (membership of
    //             each runtime key in the contract set);
    //   reverse — EVERY operation in the generated document carrying that 400 belongs to a
    //             `ParseUUIDPipe` route. The contract side scans all paths and verbs directly,
    //             so a misapplied helper on a controller with NO route parameters — outside the
    //             census entirely, invisible to the runtime scan — still fails here.
    //
    // Cause-specific by design: equality forbids only the UUID-SPECIFIC wording. A blanket ban on
    // ANY 400 off UUID routes would be a false invariant — a route can earn a 400 from an
    // unrelated deterministic cause (`PATCH /admin/seo/pages/{pageKey}` documents one for locale
    // handling) and those descriptions never carry the marker.
    //
    // The marker is also load-bearing here: if `ApiUuidParamBadRequest`'s templated description
    // ever changes, the contract side empties and this assertion fails, forcing
    // `UUID_400_DESCRIPTION_MARKER` to move in lockstep instead of silently losing its teeth.
    const documented = documentedUuid400Operations(contract).sort();
    const runtime = uuidRoutes.map(operationKey).sort();

    expect(documented).toEqual(runtime);
  });
});
