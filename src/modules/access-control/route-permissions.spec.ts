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
import { RolesAdminController } from './roles.admin.controller';
import { UsersAdminController } from './users.admin.controller';
import { REQUIRE_PERMISSION_KEY } from './decorators/require-permission.decorator';

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
describe('Route permission coverage', () => {
  const reflector = new Reflector();

  it('every non-@Public route declares a @RequirePermission key', () => {
    const violations: string[] = [];

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
          violations.push(`${controller.name}.${methodName}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
