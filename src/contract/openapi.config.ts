import { DocumentBuilder } from '@nestjs/swagger';

// One source of the OpenAPI document config, shared by the runtime /docs UI (main.ts) and
// the `contract:export` script. The generated document IS the official contract (doc 00 §3,
// doc 10 §1). `access-token` is the bearer security scheme; the refresh token is an httpOnly
// cookie handled transparently and therefore not a documented security requirement.
export function buildOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle('eslammuatamed API')
    .setDescription(
      'REST contract for the eslammuatamed platform. Public reads are unauthenticated and ' +
        'locale-resolved; the /admin surface requires a bearer access token (doc 10, doc 19).',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addTag('health', 'Liveness and readiness probes')
    .addTag('auth', 'Login, refresh rotation, and logout')
    .addTag('locales', 'Enabled content locales')
    .addTag('settings', 'Public site settings and admin management')
    .addTag('articles', 'Public article reads and admin CRUD')
    .addTag('taxonomy', 'Categories and tags')
    .addTag(
      'access-control',
      'Roles, permission grants, and operator accounts (FR-DSH-090)',
    )
    .build();
}
