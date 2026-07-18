import { Module, Provider } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';
import { StorageDriver } from '../../../config/env.validation';
import { LocalStorageAdapter } from './local-storage.adapter';
import { R2StorageAdapter } from './r2-storage.adapter';
import { STORAGE_ADAPTER, StorageAdapter } from './storage-adapter.interface';

// Exhaustiveness guard: adding a StorageDriver value without a case fails the type-check here
// (its argument stops being `never`), and an unexpected runtime value fails closed instead of
// silently defaulting to local storage.
function unsupportedDriver(driver: never): never {
  throw new Error(
    `Unsupported STORAGE_DRIVER (configuration validation should have rejected it): ${JSON.stringify(driver)}`,
  );
}

// Binds STORAGE_ADAPTER to the backend selected by STORAGE_DRIVER via an exhaustive switch (no
// silent fallback). Credentials are read from the isolated `s3Credentials` accessor and handed
// only to the R2 adapter — never on the public storage config object or logged (doc 19 §7).
// AppConfigService is global, so no import is needed.
export const storageAdapterProvider: Provider = {
  provide: STORAGE_ADAPTER,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService): StorageAdapter => {
    const { driver, localDir, publicMediaUrl, s3 } = config.storage;

    switch (driver) {
      case StorageDriver.S3: {
        if (!s3) {
          throw new Error('STORAGE_DRIVER=s3 requires the S3_* configuration');
        }
        const { accessKeyId, secretAccessKey } = config.s3Credentials;
        return new R2StorageAdapter({
          endpoint: s3.endpoint,
          region: s3.region,
          bucket: s3.bucket,
          accessKeyId,
          secretAccessKey,
          publicMediaUrl,
        });
      }
      case StorageDriver.Local:
        return new LocalStorageAdapter({ rootDir: localDir, publicMediaUrl });
      default:
        return unsupportedDriver(driver);
    }
  },
};

@Module({
  providers: [storageAdapterProvider],
  exports: [STORAGE_ADAPTER],
})
export class StorageModule {}
