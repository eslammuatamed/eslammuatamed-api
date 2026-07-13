import { plainToInstance, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
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

  @IsString()
  @IsNotEmpty()
  STORAGE_LOCAL_DIR!: string;

  @IsString()
  @IsNotEmpty()
  PUBLIC_MEDIA_URL!: string;
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

  return validated;
}
