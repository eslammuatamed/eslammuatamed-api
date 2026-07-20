import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import {
  flattenValidationErrors,
  ValidationProblemException,
} from '../../src/common/http/validation-problem.exception';

// Boots the app for e2e with the same HTTP surface main.ts configures (prefix, URI versioning,
// the whitelist/forbid/transform ValidationPipe, cookie parsing, and the doc 19 §5 1 MiB body
// limit). Guards, the RFC 7807 filter, and the envelope interceptor come from the APP_* providers
// in AppModule, so the e2e app exercises the real request pipeline. Requires a running Postgres.
export async function createE2eApp(): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
    // Mirror main.ts: register body parsers explicitly with the doc 19 §5 1 MiB limit.
    bodyParser: false,
  });

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

  await app.init();
  return app;
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
