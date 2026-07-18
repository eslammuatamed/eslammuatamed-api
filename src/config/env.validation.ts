import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
  ValidateIf,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum StorageDriver {
  Local = 'local',
  S3 = 's3',
}

// The validated, transformed shape of the environment. ConfigModule stores the instance
// this validator returns, so downstream reads are already the coerced types (number PORT,
// etc.) — the single source of typed configuration (doc 07 §3, doc 16 §1).
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  // Exact public-site origin allowed by CORS (doc 19 §2) — never "*".
  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN!: string;

  // Access-token signing secret; 32-char floor keeps HS256 keys out of brute range (doc 19 §2).
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  // A zeit/ms duration string (e.g. "15m"); parsed by @nestjs/jwt.
  @IsString()
  @Matches(/^\d+(ms|s|m|h|d)$/, {
    message: 'JWT_ACCESS_TTL must be a duration like "15m", "900s", or "1h".',
  })
  JWT_ACCESS_TTL!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  REFRESH_TOKEN_TTL_DAYS!: number;

  // Server-side pepper mixed into the refresh-token hash (doc 19 §2, §7).
  @IsString()
  @MinLength(16)
  REFRESH_TOKEN_PEPPER!: string;

  @IsString()
  @MinLength(16)
  PREVIEW_TOKEN_SECRET!: string;

  // Empty = host-only cookie (correct for localhost); a registrable domain in production (D19-3).
  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string;

  @IsEmail()
  SEED_OWNER_EMAIL!: string;

  @IsString()
  @MinLength(12)
  SEED_OWNER_PASSWORD!: string;

  @IsEnum(StorageDriver)
  STORAGE_DRIVER!: StorageDriver;

  // Required only for the local driver (D23-15); the S3_* group covers the s3/R2 driver.
  @ValidateIf(
    (env: EnvironmentVariables) => env.STORAGE_DRIVER === StorageDriver.Local,
  )
  @IsString()
  @IsNotEmpty()
  STORAGE_LOCAL_DIR!: string;

  // Public media origin for both drivers (doc 19 §5). Normalized once here: trailing slashes are
  // stripped, and the value must be an absolute http(s) URL. Production must be https — checked in
  // validate() below, since a class-validator option cannot depend on another field at decoration
  // time. require_tld is off so localhost is accepted in development.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\/+$/, '') : value,
  )
  @IsString()
  @IsNotEmpty()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  PUBLIC_MEDIA_URL!: string;

  // Cloudflare R2 (S3-compatible) — required only when STORAGE_DRIVER=s3 (doc 23 §1, D23-15).
  @ValidateIf(
    (env: EnvironmentVariables) => env.STORAGE_DRIVER === StorageDriver.S3,
  )
  @IsString()
  @IsNotEmpty()
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: false })
  S3_ENDPOINT!: string;

  @ValidateIf(
    (env: EnvironmentVariables) => env.STORAGE_DRIVER === StorageDriver.S3,
  )
  @IsString()
  @IsNotEmpty()
  S3_BUCKET!: string;

  @ValidateIf(
    (env: EnvironmentVariables) => env.STORAGE_DRIVER === StorageDriver.S3,
  )
  @IsString()
  @IsNotEmpty()
  S3_ACCESS_KEY_ID!: string;

  @ValidateIf(
    (env: EnvironmentVariables) => env.STORAGE_DRIVER === StorageDriver.S3,
  )
  @IsString()
  @IsNotEmpty()
  S3_SECRET_ACCESS_KEY!: string;

  // Optional; R2 uses "auto" and the config layer defaults it.
  @ValidateIf(
    (env: EnvironmentVariables) => env.STORAGE_DRIVER === StorageDriver.S3,
  )
  @IsOptional()
  @IsString()
  S3_REGION?: string;
}

// Passed to ConfigModule.forRoot({ validate }). Throwing here aborts boot with a readable
// message rather than surfacing a missing variable as a runtime 500 an hour later.
export function validate(raw: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => {
        const constraints = Object.values(error.constraints ?? {}).join(', ');
        return `  - ${error.property}: ${constraints || 'invalid'}`;
      })
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  // Production must use s3/R2 storage — local filesystem storage is development/test only (D23-15).
  // Fail closed at boot rather than letting the provider factory pick a backend by accident.
  if (
    validated.NODE_ENV === NodeEnv.Production &&
    validated.STORAGE_DRIVER !== StorageDriver.S3
  ) {
    throw new Error(
      'Invalid environment configuration:\n  - STORAGE_DRIVER: production requires s3 storage (local is development/test only)',
    );
  }

  // Production must serve media over https (doc 19 §5). Expressed here rather than as a decorator
  // because it depends on NODE_ENV; the URL itself was already validated + trailing-slash-normalized.
  if (
    validated.NODE_ENV === NodeEnv.Production &&
    !validated.PUBLIC_MEDIA_URL.startsWith('https://')
  ) {
    throw new Error(
      'Invalid environment configuration:\n  - PUBLIC_MEDIA_URL: must be an absolute https URL in production',
    );
  }

  return validated;
}
