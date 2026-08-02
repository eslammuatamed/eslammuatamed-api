import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { buildCorsOptions } from './common/http/cors.options';
import {
  flattenValidationErrors,
  ValidationProblemException,
} from './common/http/validation-problem.exception';
import { buildOpenApiConfig } from './contract/openapi.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Register the body parsers explicitly below so the doc 19 §5 limit is enforced (the framework
    // default caps JSON at ~100 kB, which would 413 a valid large article — 256 KiB markdown fields).
    bodyParser: false,
  });
  const config = app.get(AppConfigService);

  // Route pino through Nest's logger so framework logs are structured + redacted (D07-5).
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());

  // Trust the reverse proxy only in production so client IPs (throttling, logs) are honest
  // without letting local clients spoof X-Forwarded-For (doc 19 §11, doc 23).
  if (config.isProduction) {
    app.set('trust proxy', 1);
  }

  app.use(helmet());
  app.use(cookieParser());

  // Body parsers with the doc 19 §5 limit: 1 MiB JSON (holds the 256 KiB markdown fields; the
  // framework default of ~100 kB would 413 a large-but-valid article). Registered explicitly because
  // `bodyParser: false` above disabled the defaults. Multipart uploads use multer (ParseFilePipe,
  // media 10 MiB, D19-9) — a separate parser that is unaffected by these limits.
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // /api/v1 (D10-1): global prefix + URI versioning.
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Unknown fields are rejected and validation failures become 422 problem+json (doc 10 §3).
      exceptionFactory: (errors) =>
        new ValidationProblemException(flattenValidationErrors(errors)),
    }),
  );

  // Exact-origin CORS with credentials for the refresh cookie (doc 19 §2) — never "*". The
  // allowlist restricts origins, not what a permitted origin may read: `Retry-After` is exposed so
  // a throttled browser client can actually read the delay doc 19 §6 requires us to send (D10-15).
  app.enableCors(buildCorsOptions(config.corsOrigin));

  // Fires Nest lifecycle hooks (PrismaService.onModuleDestroy → $disconnect) on SIGTERM/SIGINT.
  // Current Prisma-with-NestJS guidance uses lifecycle hooks, not the removed $on('beforeExit').
  app.enableShutdownHooks();

  // Swagger UI at /docs — a deliberate showcase surface, public in production (D10-2).
  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(config.port);
}

void bootstrap();
