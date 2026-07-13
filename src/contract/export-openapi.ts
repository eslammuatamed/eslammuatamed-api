import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../app.module';
import { buildOpenApiConfig } from './openapi.config';

// Emits the official contract (openapi.json) WITHOUT a database (constitution rule 4): the
// Prisma connection is lazy, so booting the app graph touches no database. Prefix and
// versioning are applied identically to main.ts so the documented paths match runtime.
async function exportOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
  const outputPath = join(process.cwd(), 'openapi.json');
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);

  await app.close();
  process.stdout.write(`OpenAPI contract written to ${outputPath}\n`);
}

exportOpenApi().catch((error: unknown) => {
  process.stderr.write(`Contract export failed: ${String(error)}\n`);
  process.exit(1);
});
