import { Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { HealthController } from '../health/health.controller';
import { LocalesController } from '../locales/locales.controller';
import { AuthController } from '../auth/auth.controller';
import { SettingsController } from '../settings/settings.controller';
import { SettingsAdminController } from '../settings/settings.admin.controller';
import { CategoriesController } from '../taxonomy/categories.controller';
import { CategoriesAdminController } from '../taxonomy/categories.admin.controller';
import { TagsController } from '../taxonomy/tags.controller';
import { TagsAdminController } from '../taxonomy/tags.admin.controller';
import { ArticlesController } from '../articles/articles.controller';
import { ArticlesAdminController } from '../articles/articles.admin.controller';
import { SkillsController } from '../skills/skills.controller';
import { SkillsAdminController } from '../skills/skills.admin.controller';
import { ExperiencesController } from '../experiences/experiences.controller';
import { ExperiencesAdminController } from '../experiences/experiences.admin.controller';
import { TestimonialsController } from '../testimonials/testimonials.controller';
import { TestimonialsAdminController } from '../testimonials/testimonials.admin.controller';
import { ProjectsController } from '../projects/projects.controller';
import { ProjectsAdminController } from '../projects/projects.admin.controller';
import { MediaAdminController } from '../media/media.admin.controller';
import { MessagesAdminController } from '../contact/messages.admin.controller';
import { PreviewAdminController } from '../preview/preview.admin.controller';
import { SeoController } from '../seo/seo.controller';
import { SeoAdminController } from '../seo/seo.admin.controller';
import { RolesAdminController } from './roles.admin.controller';
import { UsersAdminController } from './users.admin.controller';
import { REQUIRE_PERMISSION_KEY } from './decorators/require-permission.decorator';
import { PERMISSIONS } from './permissions';

// The controllers this scan covers. This is a hand-maintained list, NOT auto-derived from the
// app graph, so its guarantee is scoped to the controllers below: a new controller only gains
// coverage once it is registered here. Adding a controller therefore requires adding it to this
// array (enforced by review, not by the runtime).
const CONTROLLERS: Type[] = [
  HealthController,
  LocalesController,
  AuthController,
  SettingsController,
  SettingsAdminController,
  SeoController,
  SeoAdminController,
  CategoriesController,
  CategoriesAdminController,
  TagsController,
  TagsAdminController,
  ArticlesController,
  ArticlesAdminController,
  SkillsController,
  SkillsAdminController,
  ExperiencesController,
  ExperiencesAdminController,
  TestimonialsController,
  TestimonialsAdminController,
  ProjectsController,
  ProjectsAdminController,
  MediaAdminController,
  MessagesAdminController,
  PreviewAdminController,
  RolesAdminController,
  UsersAdminController,
];

// PATH_METADATA — the key @Get/@Post/… set on a route handler. Stable Nest internal.
const ROUTE_METADATA_KEY = 'path';

// doc 19 §3 / doc 18: authorization is fail-safe by construction — a protected endpoint must
// declare its permission. This scan fails the build if any route on the listed controllers is
// neither @Public() nor @RequirePermission-decorated. It guards the enumerated controllers, so
// it catches an accidentally-undeclared route on any of them (its main value); a brand-new
// controller is covered only once added to CONTROLLERS above.
//
// D09-7 makes the correspondence BIDIRECTIONAL. Note the consequence for CONTROLLERS: the
// forward direction treats a missing controller as a silent gap, but the inverse direction
// reads a missing controller as "these keys authorize nothing" — so an unregistered controller
// can make live, guarded keys look like orphans. Never delete a catalog key on the strength of
// the inverse test alone without confirming its controller is registered above.

interface RouteScan {
  // Protected routes that declare no permission at all (forward direction).
  readonly undeclared: string[];
  // Every distinct permission key some protected route declares (inverse direction).
  readonly declaredKeys: Set<string>;
}

function scanRoutes(): RouteScan {
  const reflector = new Reflector();
  const undeclared: string[] = [];
  const declaredKeys = new Set<string>();

  for (const controller of CONTROLLERS) {
    const prototype = controller.prototype as Record<string, unknown>;
    for (const methodName of Object.getOwnPropertyNames(prototype)) {
      if (methodName === 'constructor') {
        continue;
      }
      const handler = prototype[methodName];
      if (typeof handler !== 'function') {
        continue;
      }
      const isRoute =
        Reflect.getMetadata(ROUTE_METADATA_KEY, handler) !== undefined;
      if (!isRoute) {
        continue;
      }

      const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        handler,
        controller,
      ]);
      if (isPublic) {
        continue;
      }
      const required = reflector.getAllAndOverride<string | undefined>(
        REQUIRE_PERMISSION_KEY,
        [handler, controller],
      );
      if (!required) {
        undeclared.push(`${controller.name}.${methodName}`);
        continue;
      }
      declaredKeys.add(required);
    }
  }

  return { undeclared, declaredKeys };
}

describe('Route permission coverage', () => {
  // Forward direction, part 1. Prevents an endpoint shipping with NO permission check — a route
  // that slipped past the decorator would be reachable by any authenticated user.
  it('every protected route declares a permission', () => {
    const { undeclared } = scanRoutes();

    expect(undeclared).toEqual([]);
  });

  // Forward direction, part 2. The decorator is typed as PermissionKey, so this is normally a
  // compile error — but a cast defeats that, and a key that is not in the catalog can never be
  // granted, so the route would be permanently unreachable (fail-closed, but silently). Asserting
  // it at runtime keeps the guarantee independent of the type system.
  it('every route permission exists in the runtime catalog', () => {
    const { declaredKeys } = scanRoutes();
    const catalog = new Set<string>(PERMISSIONS);

    const unknownKeys = [...declaredKeys].filter((key) => !catalog.has(key));

    expect(unknownKeys).toEqual([]);
  });

  // Inverse direction (D09-7). Prevents the opposite drift: a catalog key that authorizes no
  // route. Such a key is grantable, so an operator can build a role around a capability the API
  // does not have and get silent powerlessness — no error ever reports it. Nine keys accumulated
  // this way before this assertion existed.
  //
  // Iterating PERMISSIONS (not GRANTABLE_PERMISSIONS) is deliberate: it keeps the role wildcard
  // '*' out of the requirement structurally, with no allowlist. '*' is a grant that matches every
  // capability, not a capability a route can declare.
  //
  // There is no allowlist for planned-but-unshipped capabilities, and that is the point: an
  // unshipped capability does not belong in the runtime catalog until a route actually enforces it.
  it('every catalog permission is declared by at least one protected route', () => {
    const { declaredKeys } = scanRoutes();

    const orphanKeys = PERMISSIONS.filter((key) => !declaredKeys.has(key));

    expect(orphanKeys).toEqual([]);
  });

  // D19-8: publishing is conferred by articles.update, not by a separate key. Pinning the
  // update handler's declared permission keeps that model explicit — if someone later moves the
  // status transition behind a different key, this fails rather than silently changing who can
  // publish. The end-to-end proof (a role holding only articles.update can publish) lives in
  // test/articles.e2e-spec.ts.
  it('guards the article update route — which performs publishing — with articles.update', () => {
    const reflector = new Reflector();

    const declared = reflector.get<string | undefined>(
      REQUIRE_PERMISSION_KEY,
      ArticlesAdminController.prototype.update,
    );

    expect(declared).toBe('articles.update');
  });
});
