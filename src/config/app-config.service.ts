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

  get storage(): {
    readonly driver: StorageDriver;
    readonly localDir: string;
    readonly publicMediaUrl: string;
  } {
    return {
      driver: this.config.get('STORAGE_DRIVER', { infer: true }),
      localDir: this.config.get('STORAGE_LOCAL_DIR', { infer: true }),
      publicMediaUrl: this.config.get('PUBLIC_MEDIA_URL', { infer: true }),
    };
  }
}
