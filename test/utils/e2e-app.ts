import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { buildCorsOptions } from '../../src/common/http/cors.options';
import {
  flattenValidationErrors,
  ValidationProblemException,
} from '../../src/common/http/validation-problem.exception';

// Replaces ONE provider in the real AppModule graph for a suite that cannot otherwise reach a
// boundary — today, the SMTP transport (11B-β1 §2). Deliberately a value override on an existing
// DI token: no abstraction is introduced to satisfy a test, and everything above the token is the
// production object.
export interface E2eProviderOverride {
  readonly token: unknown;
  readonly value: unknown;
}

// The HTTP surface main.ts configures — prefix, URI versioning, the whitelist/forbid/transform
// ValidationPipe, cookie parsing, and the doc 19 §5 1 MiB body limit.
//
// Extracted so BOTH boot paths below apply the identical surface. Two independently maintained
// copies would drift, and the drifted one would be whichever the newest suite depends on.
function configureE2eApp(
  app: NestExpressApplication,
  corsOrigin: string | undefined,
): void {
  if (corsOrigin !== undefined) {
    app.enableCors(buildCorsOptions(corsOrigin));
  }

  app.use(cookieParser());
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new ValidationProblemException(flattenValidationErrors(errors)),
    }),
  );
}

// Boots the app for e2e. Guards, the RFC 7807 filter, and the envelope interceptor come from the
// APP_* providers in AppModule, so the e2e app exercises the real request pipeline. Requires a
// running Postgres.
//
// `corsOrigin` opts a suite into the real CORS layer. It is off by default because CORS is inert
// for supertest's same-process requests and every existing suite is written without it; the one
// suite that asserts the policy (cors.e2e-spec.ts) passes the origin so it exercises
// buildCorsOptions() — the same object main.ts installs — rather than a hand-copied approximation.
//
// `overrides` selects the Nest TESTING module builder, which is the only way to replace a provider
// in an already-declared module. The no-override path deliberately still uses `NestFactory.create`
// exactly as before: every existing suite keeps its byte-identical boot, so this seam cannot
// regress thirty suites to buy one.
export async function createE2eApp(
  options: {
    readonly corsOrigin?: string;
    readonly overrides?: readonly E2eProviderOverride[];
  } = {},
): Promise<INestApplication> {
  const overrides = options.overrides ?? [];
  const app =
    overrides.length === 0
      ? await NestFactory.create<NestExpressApplication>(AppModule, {
          logger: false,
          // Mirror main.ts: register body parsers explicitly with the doc 19 §5 1 MiB limit.
          bodyParser: false,
        })
      : await createOverriddenApp(overrides);

  configureE2eApp(app, options.corsOrigin);

  await app.init();
  return app;
}

async function createOverriddenApp(
  overrides: readonly E2eProviderOverride[],
): Promise<NestExpressApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  for (const { token, value } of overrides) {
    builder = builder.overrideProvider(token).useValue(value);
  }
  const moduleRef = await builder.compile();
  return moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
    bodyParser: false,
  });
}

export const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? 'owner@example.com';
export const OWNER_PASSWORD =
  process.env.SEED_OWNER_PASSWORD ?? 'change-me-minimum-12';

// supertest types the underlying server and response body as `any`; these helpers localize the
// casts so the specs stay free of unsafe-any access (constitution rule 7, doc 15 §1).
export function httpServer(app: INestApplication): App {
  return app.getHttpServer() as App;
}

export function envelopeData<T>(res: Response): T {
  return (res.body as { data: T }).data;
}

export function problemBody(res: Response): { status: number; type: string } {
  return res.body as { status: number; type: string };
}
