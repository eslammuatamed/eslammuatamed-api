import { NodeEnv, StorageDriver, validate } from './env.validation';

const validEnv = (): Record<string, string> => ({
  NODE_ENV: 'test',
  PORT: '3001',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  CORS_ORIGIN: 'http://localhost:3000',
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
});
