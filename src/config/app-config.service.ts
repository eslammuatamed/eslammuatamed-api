import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables, NodeEnv, StorageDriver } from './env.validation';

// The single typed door to configuration. No code outside this module reads process.env
// (doc 07 §3, constitution rule 5); everything injects this service and gets coerced,
// grouped values. `ConfigService<…, true>` marks the config validated, so getters never
// return undefined for a required key.
@Injectable()
export class AppConfigService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  get nodeEnv(): NodeEnv {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === NodeEnv.Production;
  }

  get isTest(): boolean {
    return this.nodeEnv === NodeEnv.Test;
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === NodeEnv.Development;
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get corsOrigin(): string {
    return this.config.get('CORS_ORIGIN', { infer: true });
  }

  get database(): { readonly url: string } {
    return { url: this.config.get('DATABASE_URL', { infer: true }) };
  }

  get auth(): {
    readonly jwtAccessSecret: string;
    readonly jwtAccessTtl: string;
    readonly refreshTokenTtlDays: number;
    readonly refreshTokenPepper: string;
    readonly previewTokenSecret: string;
    readonly cookieDomain: string | undefined;
  } {
    const cookieDomain = this.config.get('COOKIE_DOMAIN', { infer: true });
    return {
      jwtAccessSecret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      jwtAccessTtl: this.config.get('JWT_ACCESS_TTL', { infer: true }),
      refreshTokenTtlDays: this.config.get('REFRESH_TOKEN_TTL_DAYS', {
        infer: true,
      }),
      refreshTokenPepper: this.config.get('REFRESH_TOKEN_PEPPER', {
        infer: true,
      }),
      previewTokenSecret: this.config.get('PREVIEW_TOKEN_SECRET', {
        infer: true,
      }),
      // Empty string means host-only; normalize to undefined so the cookie omits Domain.
      cookieDomain:
        cookieDomain && cookieDomain.length > 0 ? cookieDomain : undefined,
    };
  }

  get seed(): { readonly ownerEmail: string; readonly ownerPassword: string } {
    return {
      ownerEmail: this.config.get('SEED_OWNER_EMAIL', { infer: true }),
      ownerPassword: this.config.get('SEED_OWNER_PASSWORD', { infer: true }),
    };
  }

  // The public storage config — safe to log. Credentials are deliberately absent (doc 19 §7);
  // the R2 adapter reads them through `s3Credentials`. `s3` is null under the local driver.
  get storage(): {
    readonly driver: StorageDriver;
    readonly localDir: string;
    readonly publicMediaUrl: string;
    readonly s3: {
      readonly endpoint: string;
      readonly bucket: string;
      readonly region: string;
    } | null;
  } {
    const driver = this.config.get('STORAGE_DRIVER', { infer: true });
    return {
      driver,
      localDir: this.config.get('STORAGE_LOCAL_DIR', { infer: true }),
      publicMediaUrl: this.config.get('PUBLIC_MEDIA_URL', { infer: true }),
      s3:
        driver === StorageDriver.S3
          ? {
              endpoint: this.config.get('S3_ENDPOINT', { infer: true }),
              bucket: this.config.get('S3_BUCKET', { infer: true }),
              region: this.config.get('S3_REGION', { infer: true }) ?? 'auto',
            }
          : null,
    };
  }

  // Read ONLY by the R2 storage adapter factory; never placed on the public `storage` object and
  // never logged (doc 19 §7). Isolated here so a config dump cannot leak the bucket credentials.
  get s3Credentials(): {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
  } {
    return {
      accessKeyId: this.config.get('S3_ACCESS_KEY_ID', { infer: true }),
      secretAccessKey: this.config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
    };
  }
}
