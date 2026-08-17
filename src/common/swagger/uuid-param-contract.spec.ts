import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ParseUUIDPipe, Type } from '@nestjs/common';
import { RolesAdminController } from '../../modules/access-control/roles.admin.controller';
import { UsersAdminController } from '../../modules/access-control/users.admin.controller';
import { ArticlesAdminController } from '../../modules/articles/articles.admin.controller';
import { MessagesAdminController } from '../../modules/contact/messages.admin.controller';
import { ExperiencesAdminController } from '../../modules/experiences/experiences.admin.controller';
import { MediaAdminController } from '../../modules/media/media.admin.controller';
import { PreviewAdminController } from '../../modules/preview/preview.admin.controller';
import { PreviewController } from '../../modules/preview/preview.controller';
import { ProjectsAdminController } from '../../modules/projects/projects.admin.controller';
import { SkillsAdminController } from '../../modules/skills/skills.admin.controller';
import { CategoriesAdminController } from '../../modules/taxonomy/categories.admin.controller';
import { TagsAdminController } from '../../modules/taxonomy/tags.admin.controller';
import { TestimonialsAdminController } from '../../modules/testimonials/testimonials.admin.controller';

/**
 * `ParseUUIDPipe` runs before the global `ValidationPipe` and answers a malformed
 * `:id` with **400** — a status no request body or query explains, and one that a client can hit
 * on every one of these routes. Before this phase exactly two of the 35 said so in OpenAPI.
 *
 * Owner policy: a route that can deterministically return 400 because its declared path parameter
 * is parsed by the standard `ParseUUIDPipe` SHOULD document that 400 — and a route that cannot
 * must NOT, which is why the declaration is per-handler rather than folded into the class-level
 * `ApiAdminErrorResponses()`.
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

// Every controller that declares at least one route parameter. `PreviewController` is included
// even though it is `@Public()`: its 400 is a published contract like any other.
const CONTROLLERS: Type[] = [
  ArticlesAdminController,
  CategoriesAdminController,
  ExperiencesAdminController,
  MediaAdminController,
  MessagesAdminController,
  PreviewAdminController,
  PreviewController,
  ProjectsAdminController,
  RolesAdminController,
  SkillsAdminController,
  TagsAdminController,
  TestimonialsAdminController,
  UsersAdminController,
];

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
    Record<string, { responses?: Record<string, unknown> }>
  >;
}

function loadContract(): OpenApiDocument {
  return JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', 'openapi.json'), 'utf8'),
  ) as OpenApiDocument;
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
    for (const route of uuidRoutes) {
      expect(contract.paths[route.path]?.[route.verb]).toBeDefined();
    }
  });

  it('declares 400 on every route whose path parameter is parsed by ParseUUIDPipe', () => {
    const undeclared = uuidRoutes
      .filter(
        (route) =>
          contract.paths[route.path]?.[route.verb]?.responses?.['400'] ===
          undefined,
      )
      .map(
        (route) =>
          `${route.verb.toUpperCase()} ${route.path} (${route.handler})`,
      );

    expect(undeclared).toEqual([]);
  });

  it('does not declare 400 on routes that have no UUID parameter to reject', () => {
    // The half that keeps the contract from becoming broader-and-vaguer. The public read routes
    // are the one legitimate exception: `ApiPublicReadErrorResponses()` declares 400 for an
    // unknown or disabled locale, which is a different and pre-existing cause.
    //
    // The exemption is stated as it is ACTUALLY scoped, not as it is motivated: it excuses every
    // NON-ADMIN route, not only the ones that resolve a locale. Narrowing it to a locale test
    // would mean asking the contract whether a route takes `?locale=`, which is a second and
    // weaker guess at the same thing. The admin surface — where over-declaration was the real
    // risk, because that is where a class-level decorator would have applied — is fully guarded.
    const localeAware = (route: Route): boolean =>
      contract.paths[route.path]?.[route.verb]?.responses?.['400'] !==
        undefined && !route.path.startsWith(`${GLOBAL_PREFIX}/admin/`);

    const overdeclared = routes
      .filter((route) => !route.parsesUuidParam)
      .filter(
        (route) =>
          contract.paths[route.path]?.[route.verb]?.responses?.['400'] !==
          undefined,
      )
      .filter((route) => !localeAware(route))
      .map(
        (route) =>
          `${route.verb.toUpperCase()} ${route.path} (${route.handler})`,
      );

    expect(overdeclared).toEqual([]);
  });
});
