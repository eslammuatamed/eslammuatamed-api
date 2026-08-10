import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
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

  // Structural, not merely present (D16-12). `@IsNotEmpty()` alone was a fail-open gate: it
  // accepted a whitespace-only value, a bare database name, `mysql://`, and a newline-injected
  // second assignment — including the exact historical value that created a URL-encoded 63-byte
  // database instead of aborting. The malformed string reached Prisma and became runtime behavior
  // an hour later, which is the failure doc 16 §1 promises never to have.
  //
  // A regex rather than a DSN parser on purpose: a parser is a second implementation of a format
  // PostgreSQL already defines, and every field it checked would be one more way to wrongly reject
  // a legitimate production URL. This asserts only what is unambiguous — a supported scheme and no
  // whitespace — and deliberately says NOTHING about the database name: pointing at the wrong
  // database is D18-8's fail-closed assertion in the e2e harness, while this gate must accept any
  // legitimate production name.
  @IsString()
  @Matches(/^postgres(ql)?:\/\/\S+$/, {
    message:
      'DATABASE_URL must be a whitespace-free postgresql:// or postgres:// connection string.',
  })
  DATABASE_URL!: string;

  // Exact public-site origin allowed by CORS (doc 19 §2) — never "*".
  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN!: string;

  // Absolute origin of the rendered Web app that hosts the human-facing preview page (D10-11 v1.4.1):
  // the API signs the token, the Web renders the page. Deliberately a DEDICATED config, never derived
  // from CORS_ORIGIN — it is the canonical public-site origin and may differ. Trailing slashes are
  // stripped so the minted url never contains "//". Defaults to http://localhost:3000 outside production
  // (keeps local dev, tests, and the DB-free contract:export booting); production must set it explicitly —
  // left undefined there, the IsNotEmpty/IsUrl decorators below fail and abort boot. The dev default is
  // injected in validate() since the rule depends on NODE_ENV. require_tld is off so localhost is accepted.
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
  PUBLIC_WEB_URL!: string;

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

  // ── Outbound SMTP (contact notifications) ────────────────────────────────────────────────
  // Mail is an OPTIONAL side effect, never a boot dependency: the contact intake's authoritative
  // act is the database commit, and an API that refuses to boot without a mail relay would turn a
  // delivery concern into an availability one. So the whole group is gated on SMTP_ENABLED and
  // defaults OFF — an environment that never sets it behaves exactly as it does today.
  //
  // The gate is an EXPLICIT flag rather than "SMTP_HOST is present". Presence-inference cannot tell
  // a deliberately-unconfigured environment from a half-configured one, so a typo'd host name would
  // read as "mail off" and fail silently — the one failure mode a notification path must not have.
  // With the flag on, every field below is required and a missing one aborts boot loudly.
  //
  // Same shape as the S3_* group above (@ValidateIf on a single discriminator), for the same
  // reason: `npm run contract:export` and the test suite boot with none of this set.
  @Transform(({ value }: { value: unknown }) => toOptionalBoolean(value))
  @IsOptional()
  @IsBoolean()
  SMTP_ENABLED?: boolean;

  @ValidateIf((env: EnvironmentVariables) => env.SMTP_ENABLED === true)
  @IsString()
  @IsNotEmpty()
  SMTP_HOST!: string;

  @ValidateIf((env: EnvironmentVariables) => env.SMTP_ENABLED === true)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT!: number;

  // Implicit TLS on connect (port 465) vs. STARTTLS upgrade on a cleartext port (587). Explicit
  // because the two are not interchangeable and guessing from the port number would silently pick
  // the wrong handshake against a non-standard relay.
  @ValidateIf((env: EnvironmentVariables) => env.SMTP_ENABLED === true)
  @Transform(({ value }: { value: unknown }) => toOptionalBoolean(value))
  @IsOptional()
  @IsBoolean()
  SMTP_SECURE?: boolean;

  @ValidateIf((env: EnvironmentVariables) => env.SMTP_ENABLED === true)
  @IsString()
  @IsNotEmpty()
  SMTP_USER!: string;

  // Secret (doc 19 §7): read only through `AppConfigService.smtpCredentials`, never placed on the
  // loggable mail config object.
  @ValidateIf((env: EnvironmentVariables) => env.SMTP_ENABLED === true)
  @IsString()
  @IsNotEmpty()
  SMTP_PASSWORD!: string;

  // Envelope sender. A bare address, not a display-name form: the display name is a presentation
  // choice the mail layer applies, and embedding one here would put message formatting in the
  // environment where it cannot be validated.
  @ValidateIf((env: EnvironmentVariables) => env.SMTP_ENABLED === true)
  @IsEmail()
  SMTP_FROM!: string;

  // Owner notification destination. A DEDICATED delivery config, deliberately NOT read from
  // `SiteSettings.contactEmail`: doc 10 states those fields "carry no delivery or secret
  // configuration", and they are published content a visitor reads — routing operational mail
  // through them would let a content edit silently redirect the owner's notifications.
  @ValidateIf((env: EnvironmentVariables) => env.SMTP_ENABLED === true)
  @IsEmail()
  CONTACT_NOTIFICATION_TO!: string;
}

// Environment values are always strings, so a boolean flag needs an explicit parse. Only the two
// canonical spellings are accepted; anything else stays untouched and fails @IsBoolean below rather
// than being coerced. That matters because the permissive JS reading of a stray value is `true` —
// `SMTP_ENABLED=no` must abort boot, not silently enable mail.
function toOptionalBoolean(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return value;
}

// Passed to ConfigModule.forRoot({ validate }). Throwing here aborts boot with a readable
// message rather than surfacing a missing variable as a runtime 500 an hour later.
export function validate(raw: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: false,
  });

  // PUBLIC_WEB_URL defaults to http://localhost:3000 outside production so local dev, tests, and the
  // DB-free contract:export boot without it; production must set it explicitly — left undefined there,
  // the IsNotEmpty/IsUrl decorators fail below and abort boot. NODE_ENV-dependent, so applied here
  // rather than as a static decorator default (D10-11 v1.4.1: the API signs, the Web renders).
  if (
    validated.NODE_ENV !== NodeEnv.Production &&
    validated.PUBLIC_WEB_URL === undefined
  ) {
    validated.PUBLIC_WEB_URL = 'http://localhost:3000';
  }

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
