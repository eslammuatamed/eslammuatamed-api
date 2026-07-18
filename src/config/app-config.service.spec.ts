import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import { EnvironmentVariables, StorageDriver } from './env.validation';

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
