import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import {
  EnvironmentVariables,
  StorageDriver,
  validate,
} from './env.validation';

// A minimal fake ConfigService returning values from a map; it ignores the `{ infer }` option.
const fakeConfig = (
  values: Record<string, unknown>,
): ConfigService<EnvironmentVariables, true> =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService<
    EnvironmentVariables,
    true
  >;

describe('AppConfigService — storage secrecy (doc 19 §7)', () => {
  const s3Env = {
    STORAGE_DRIVER: StorageDriver.S3,
    STORAGE_LOCAL_DIR: './storage',
    PUBLIC_MEDIA_URL: 'https://media.eslammuatamed.com',
    S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
    S3_BUCKET: 'media',
    S3_REGION: 'auto',
    S3_ACCESS_KEY_ID: 'AKID-must-not-leak',
    S3_SECRET_ACCESS_KEY: 'SECRET-must-not-leak',
  };

  it('keeps credentials out of the public storage config object', () => {
    const service = new AppConfigService(fakeConfig(s3Env));
    const storage = service.storage;
    const serialized = JSON.stringify(storage);

    expect(serialized).not.toContain('AKID-must-not-leak');
    expect(serialized).not.toContain('SECRET-must-not-leak');
    expect(storage.s3).toEqual({
      endpoint: s3Env.S3_ENDPOINT,
      bucket: 'media',
      region: 'auto',
    });
  });

  it('exposes credentials only through the dedicated s3Credentials accessor', () => {
    const service = new AppConfigService(fakeConfig(s3Env));
    expect(service.s3Credentials).toEqual({
      accessKeyId: 'AKID-must-not-leak',
      secretAccessKey: 'SECRET-must-not-leak',
    });
  });

  it('returns a null s3 block under the local driver', () => {
    const service = new AppConfigService(
      fakeConfig({
        STORAGE_DRIVER: StorageDriver.Local,
        STORAGE_LOCAL_DIR: './storage',
        PUBLIC_MEDIA_URL: 'http://localhost:3001/media',
      }),
    );
    expect(service.storage.s3).toBeNull();
  });
});

describe('AppConfigService — mail secrecy and the enabled gate (doc 19 §7)', () => {
  // Composes the two real halves — `validate()` then the getter — rather than hand-writing the
  // stored shape. The whole gate turns on `SMTP_ENABLED` being a real boolean by the time the
  // getter compares it: if the raw string `'true'` reached `=== true`, `enabled` would silently
  // compute false and mail would never send in an environment configured to send it. That is the
  // exact silent failure the explicit flag exists to prevent, so it is asserted end to end.
  const storedEnv = (
    overrides: Record<string, string> = {},
  ): Record<string, unknown> =>
    validate({
      NODE_ENV: 'test',
      PORT: '3001',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      CORS_ORIGIN: 'http://localhost:3000',
      PUBLIC_WEB_URL: 'http://localhost:3000',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_ACCESS_TTL: '15m',
      REFRESH_TOKEN_TTL_DAYS: '7',
      REFRESH_TOKEN_PEPPER: 'b'.repeat(16),
      PREVIEW_TOKEN_SECRET: 'c'.repeat(16),
      COOKIE_DOMAIN: '',
      SEED_OWNER_EMAIL: 'owner@example.com',
      SEED_OWNER_PASSWORD: 'change-me-12chars',
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_DIR: './storage',
      PUBLIC_MEDIA_URL: 'http://localhost:3001/media',
      ...overrides,
    }) as unknown as Record<string, unknown>;

  const enabledMailEnv = (): Record<string, unknown> =>
    storedEnv({
      SMTP_ENABLED: 'true',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'relay-user',
      SMTP_PASSWORD: 'SMTP-SECRET-must-not-leak',
      SMTP_FROM: 'no-reply@eslammuatamed.com',
      CONTACT_NOTIFICATION_TO: 'owner@eslammuatamed.com',
    });

  it('reads the enabled flag and port back as coerced types, not raw strings', () => {
    const service = new AppConfigService(fakeConfig(enabledMailEnv()));

    expect(service.mail.enabled).toBe(true);
    expect(service.mail.smtp).toEqual({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      user: 'relay-user',
    });
    expect(typeof service.mail.smtp?.port).toBe('number');
  });

  it('keeps the SMTP password out of the public mail config object', () => {
    const service = new AppConfigService(fakeConfig(enabledMailEnv()));

    expect(JSON.stringify(service.mail)).not.toContain(
      'SMTP-SECRET-must-not-leak',
    );
  });

  it('exposes the password only through the dedicated smtpCredentials accessor', () => {
    const service = new AppConfigService(fakeConfig(enabledMailEnv()));

    expect(service.smtpCredentials).toEqual({
      user: 'relay-user',
      password: 'SMTP-SECRET-must-not-leak',
    });
  });

  it('reports a fully null mail block when the group is absent', () => {
    const service = new AppConfigService(fakeConfig(storedEnv()));

    expect(service.mail).toEqual({
      enabled: false,
      smtp: null,
      from: null,
      ownerNotificationTo: null,
    });
  });

  // Defaulting an omitted SMTP_SECURE to implicit TLS: the safe reading of an ambiguous config.
  it('defaults secure to true when the flag is omitted', () => {
    const env = enabledMailEnv();
    delete env.SMTP_SECURE;

    expect(new AppConfigService(fakeConfig(env)).mail.smtp?.secure).toBe(true);
  });
});
