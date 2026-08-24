import { NodeEnv, StorageDriver, validate } from './env.validation';

const validEnv = (): Record<string, string> => ({
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
});

describe('validate (environment schema)', () => {
  it('accepts a complete, valid environment and coerces numeric fields', () => {
    const result = validate(validEnv());

    expect(result.NODE_ENV).toBe(NodeEnv.Test);
    expect(result.PORT).toBe(3001);
    expect(typeof result.PORT).toBe('number');
    expect(result.REFRESH_TOKEN_TTL_DAYS).toBe(7);
    expect(result.STORAGE_DRIVER).toBe(StorageDriver.Local);
  });

  it('rejects a missing required variable', () => {
    const env = validEnv();
    delete env.DATABASE_URL;

    expect(() => validate(env)).toThrow(/DATABASE_URL/);
  });

  // Every case below runs the REAL exported `validate()`, because the defect being closed
  // was that this exact function accepted six of six malformed values and let the process boot.
  describe('DATABASE_URL is validated structurally', () => {
    const withDatabaseUrl = (value: string): Record<string, string> => ({
      ...validEnv(),
      DATABASE_URL: value,
    });

    // The shapes every lane actually uses. A gate that rejected one of these would break a lane,
    // so they are asserted rather than assumed.
    it.each([
      [
        '.env.example / local dev',
        'postgresql://eslammuatamed@localhost:5432/eslammuatamed_dev',
      ],
      [
        'CI e2e job',
        'postgresql://eslammuatamed:eslammuatamed@localhost:5432/eslammuatamed_test',
      ],
      [
        'e2e harness generated (D18-8)',
        'postgresql://eslammuatamed@localhost:5432/eslammuatamed_e2e_0123456789abcdef01234567',
      ],
      [
        'production-shaped: encoded password + query parameters',
        'postgresql://api_user:p%40ss%3Aword@db.internal:6432/eslammuatamed?sslmode=require&connection_limit=10',
      ],
      [
        'postgres:// scheme',
        'postgres://eslammuatamed@localhost:5432/eslammuatamed_dev',
      ],
    ])('accepts the %s DSN', (_label, dsn) => {
      expect(validate(withDatabaseUrl(dsn)).DATABASE_URL).toBe(dsn);
    });

    // The six values the audit proved `validate()` accepted before this rule existed.
    it.each([
      [
        'the historical bug — a shell-injected second assignment',
        'postgresql://u@localhost:5432/eslammuatamed_test SEED_OWNER_EMAIL=x SEED_OWNER_PASSWORD=y',
      ],
      ['no scheme at all, just a database name', 'eslammuatamed_dev'],
      ['no scheme, host:port form', 'localhost:5432/eslammuatamed_dev'],
      ['a foreign scheme', 'mysql://user@localhost:3306/db'],
      ['whitespace only', '   '],
      ['empty', ''],
      [
        'a newline-injected environment fragment',
        'postgresql://u@localhost:5432/db\nFOO=bar',
      ],
      ['an embedded space', 'postgresql://u@local host:5432/db'],
      ['a leading space', ' postgresql://u@localhost:5432/db'],
      ['a trailing newline', 'postgresql://u@localhost:5432/db\n'],
      ['a scheme with nothing after it', 'postgresql://'],
    ])('aborts the boot on %s', (_label, dsn) => {
      expect(() => validate(withDatabaseUrl(dsn))).toThrow(
        /DATABASE_URL: .*whitespace-free postgresql:\/\/ or postgres:\/\//,
      );
    });
  });

  it('rejects an access secret shorter than 32 characters', () => {
    const env = validEnv();
    env.JWT_ACCESS_SECRET = 'too-short';

    expect(() => validate(env)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects a non-numeric PORT', () => {
    const env = validEnv();
    env.PORT = 'not-a-number';

    expect(() => validate(env)).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    const env = validEnv();
    env.NODE_ENV = 'staging';

    expect(() => validate(env)).toThrow(/NODE_ENV/);
  });

  it('rejects a malformed JWT_ACCESS_TTL', () => {
    const env = validEnv();
    env.JWT_ACCESS_TTL = '15 minutes';

    expect(() => validate(env)).toThrow(/JWT_ACCESS_TTL/);
  });

  it('rejects a seed password under 12 characters', () => {
    const env = validEnv();
    env.SEED_OWNER_PASSWORD = 'short';

    expect(() => validate(env)).toThrow(/SEED_OWNER_PASSWORD/);
  });

  it('allows an empty COOKIE_DOMAIN (host-only cookie)', () => {
    const env = validEnv();
    env.COOKIE_DOMAIN = '';

    expect(() => validate(env)).not.toThrow();
  });

  const validS3Env = (): Record<string, string> => ({
    ...validEnv(),
    STORAGE_DRIVER: 's3',
    PUBLIC_MEDIA_URL: 'https://media.eslammuatamed.com',
    S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
    S3_BUCKET: 'media',
    S3_ACCESS_KEY_ID: 'akid',
    S3_SECRET_ACCESS_KEY: 'secret',
    S3_REGION: 'auto',
  });

  it('accepts a local environment without any S3_* variables', () => {
    expect(() => validate(validEnv())).not.toThrow();
  });

  it('accepts a complete s3 environment', () => {
    expect(() => validate(validS3Env())).not.toThrow();
  });

  it('rejects an s3 environment missing a required S3_* value', () => {
    const env = validS3Env();
    delete env.S3_BUCKET;

    expect(() => validate(env)).toThrow(/S3_BUCKET/);
  });

  it('rejects a malformed PUBLIC_MEDIA_URL', () => {
    const env = validEnv();
    env.PUBLIC_MEDIA_URL = 'not-a-url';

    expect(() => validate(env)).toThrow(/PUBLIC_MEDIA_URL/);
  });

  it('strips a trailing slash from PUBLIC_MEDIA_URL', () => {
    const env = validEnv();
    env.PUBLIC_MEDIA_URL = 'http://localhost:3001/media/';

    expect(validate(env).PUBLIC_MEDIA_URL).toBe('http://localhost:3001/media');
  });

  it('requires an https PUBLIC_MEDIA_URL in production', () => {
    const env = validS3Env();
    env.NODE_ENV = 'production';
    env.PUBLIC_MEDIA_URL = 'http://media.eslammuatamed.com';
    expect(() => validate(env)).toThrow(/PUBLIC_MEDIA_URL/);

    env.PUBLIC_MEDIA_URL = 'https://media.eslammuatamed.com';
    expect(() => validate(env)).not.toThrow();
  });

  it('rejects an unknown STORAGE_DRIVER (fails closed, no fallback)', () => {
    const env = validEnv();
    env.STORAGE_DRIVER = 'gcs';

    expect(() => validate(env)).toThrow(/STORAGE_DRIVER/);
  });

  it('rejects local storage in production', () => {
    const env = validEnv();
    env.NODE_ENV = 'production';
    env.STORAGE_DRIVER = 'local';
    env.PUBLIC_MEDIA_URL = 'https://media.eslammuatamed.com';

    expect(() => validate(env)).toThrow(/STORAGE_DRIVER/);
  });

  it('accepts s3 storage in production', () => {
    const env = validS3Env();
    env.NODE_ENV = 'production';

    expect(() => validate(env)).not.toThrow();
  });

  it('accepts local storage in development', () => {
    const env = validEnv();
    env.NODE_ENV = 'development';

    expect(() => validate(env)).not.toThrow();
  });

  it('accepts s3 storage in development when all S3 variables exist', () => {
    const env = validS3Env();
    env.NODE_ENV = 'development';

    expect(() => validate(env)).not.toThrow();
  });

  it('defaults PUBLIC_WEB_URL to http://localhost:3000 outside production when unset (D10-11 v1.4.1)', () => {
    const env = validEnv();
    delete env.PUBLIC_WEB_URL;

    expect(validate(env).PUBLIC_WEB_URL).toBe('http://localhost:3000');
  });

  it('accepts an explicit absolute PUBLIC_WEB_URL', () => {
    const env = validEnv();
    env.PUBLIC_WEB_URL = 'https://eslammuatamed.com';

    expect(validate(env).PUBLIC_WEB_URL).toBe('https://eslammuatamed.com');
  });

  it('strips a trailing slash from PUBLIC_WEB_URL', () => {
    const env = validEnv();
    env.PUBLIC_WEB_URL = 'https://eslammuatamed.com/';

    expect(validate(env).PUBLIC_WEB_URL).toBe('https://eslammuatamed.com');
  });

  it('rejects a non-URL PUBLIC_WEB_URL', () => {
    const env = validEnv();
    env.PUBLIC_WEB_URL = 'not-a-url';

    expect(() => validate(env)).toThrow(/PUBLIC_WEB_URL/);
  });

  it('requires PUBLIC_WEB_URL in production (no default → boot fails)', () => {
    const env = validS3Env();
    env.NODE_ENV = 'production';
    delete env.PUBLIC_WEB_URL;
    expect(() => validate(env)).toThrow(/PUBLIC_WEB_URL/);

    env.PUBLIC_WEB_URL = 'https://eslammuatamed.com';
    expect(() => validate(env)).not.toThrow();
  });

  // The mail group is optional as a UNIT (SMTP_ENABLED gates it), for the same reason the S3_*
  // group is gated on STORAGE_DRIVER: contract:export and the test suite boot without it.
  describe('SMTP group', () => {
    const smtpEnv = (): Record<string, string> => ({
      ...validEnv(),
      SMTP_ENABLED: 'true',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'relay-user',
      SMTP_PASSWORD: 'relay-password',
      SMTP_FROM: 'no-reply@example.com',
      CONTACT_NOTIFICATION_TO: 'owner@example.com',
    });

    it('boots with the entire group absent — mail is optional, never a boot dependency', () => {
      const result = validate(validEnv());

      expect(result.SMTP_ENABLED).toBeUndefined();
    });

    it('accepts a complete enabled group and coerces the flag and port', () => {
      const result = validate(smtpEnv());

      expect(result.SMTP_ENABLED).toBe(true);
      expect(result.SMTP_SECURE).toBe(true);
      expect(result.SMTP_PORT).toBe(465);
      expect(typeof result.SMTP_PORT).toBe('number');
    });

    it.each([
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'SMTP_FROM',
      'CONTACT_NOTIFICATION_TO',
    ])('aborts boot when %s is missing while mail is enabled', (key) => {
      const env = smtpEnv();
      delete env[key];

      expect(() => validate(env)).toThrow(new RegExp(key));
    });

    it('ignores an incomplete group while mail is disabled', () => {
      const env = { ...validEnv(), SMTP_ENABLED: 'false', SMTP_HOST: '' };

      expect(() => validate(env)).not.toThrow();
    });

    // The permissive JS reading of a stray value is `true`; a typo must abort boot, not silently
    // enable a half-configured mail path.
    it('rejects a flag value that is neither "true" nor "false"', () => {
      const env = { ...validEnv(), SMTP_ENABLED: 'yes' };

      expect(() => validate(env)).toThrow(/SMTP_ENABLED/);
    });

    it('rejects a malformed sender or notification address', () => {
      expect(() =>
        validate({ ...smtpEnv(), SMTP_FROM: 'not-an-email' }),
      ).toThrow(/SMTP_FROM/);
      expect(() =>
        validate({ ...smtpEnv(), CONTACT_NOTIFICATION_TO: 'not-an-email' }),
      ).toThrow(/CONTACT_NOTIFICATION_TO/);
    });
  });
});
