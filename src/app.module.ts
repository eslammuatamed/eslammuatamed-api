import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/app-config.service';
import { PrismaModule } from './prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './modules/access-control/guards/permissions.guard';
import { buildPinoOptions } from './common/logging/pino-logger.config';
import { THROTTLE_TIERS } from './common/throttling/throttle-tiers';
import { HealthModule } from './modules/health/health.module';
import { LocalesModule } from './modules/locales/locales.module';
import { AuthModule } from './modules/auth/auth.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TaxonomyModule } from './modules/taxonomy/taxonomy.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { AccessControlModule } from './modules/access-control/access-control.module';
import { SkillsModule } from './modules/skills/skills.module';
import { ExperiencesModule } from './modules/experiences/experiences.module';
import { TestimonialsModule } from './modules/testimonials/testimonials.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { MediaModule } from './modules/media/media.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => buildPinoOptions(config),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: THROTTLE_TIERS.public.ttl,
        limit: THROTTLE_TIERS.public.limit,
      },
    ]),
    ScheduleModule.forRoot(),
    HealthModule,
    LocalesModule,
    AuthModule,
    SettingsModule,
    TaxonomyModule,
    ArticlesModule,
    AccessControlModule,
    SkillsModule,
    ExperiencesModule,
    TestimonialsModule,
    ProjectsModule,
    MediaModule,
  ],
  providers: [
    // Guards run in registration order: throttle first (applies even to public), then
    // authenticate (default-deny, sets request.user), then authorize by permission (D19-8 —
    // grants resolved from the database per request).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class AppModule {}
