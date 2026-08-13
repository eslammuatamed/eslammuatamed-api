import { plainToInstance } from 'class-transformer';
import type { ClassConstructor } from 'class-transformer';
import { validateSync } from 'class-validator';
import { toOptionalBoolean } from './boolean-query';
import { MessageListQueryDto } from '../../modules/contact/dto/message-list.query.dto';
import { AdminProjectListQueryDto } from '../../modules/projects/dto/project-query.dto';
import { validate as validateEnv } from '../../config/env.validation';

// C-3. `toOptionalBoolean` had three declarations with two behaviours. Two of them (this one and
// `MessageListQueryDto`'s private copy) were byte-identical and are now one; the third, in
// `config/env.validation.ts`, is deliberately MORE tolerant. These tests pin both halves of that
// outcome — the sharing AND the deliberate difference — so a future "cleanup" that merges the
// config copy into the query helper fails here instead of silently widening the API contract.
describe('toOptionalBoolean (query-string semantics)', () => {
  it.each([
    ['true', true],
    ['false', false],
    [true, true],
    [false, false],
  ])('coerces the documented token %p to %p', (input, expected) => {
    expect(toOptionalBoolean(input)).toBe(expected);
  });

  // The whole point of the helper: anything it does not recognize is returned UNCHANGED so
  // `@IsBoolean()` rejects it with a 422. Returning `false` here is the bug it exists to prevent —
  // a filter that silently claims to have filtered on a value the client never sent.
  it.each([
    ['TRUE'],
    ['True'],
    [' true '],
    ['1'],
    ['0'],
    ['yes'],
    ['no'],
    [''],
    ['null'],
  ])(
    'leaves the unrecognized value %p untouched for @IsBoolean to reject',
    (input) => {
      expect(toOptionalBoolean(input)).toBe(input);
    },
  );

  it('leaves a missing value undefined rather than defaulting it to false', () => {
    expect(toOptionalBoolean(undefined)).toBeUndefined();
    expect(toOptionalBoolean(null)).toBeNull();
  });
});

// Both query DTOs must go through the SHARED helper. Asserting on validated DTO instances (not on
// the function) is what makes this discriminating: it would still pass if someone re-inlined a
// correct private copy, but it fails the moment either DTO's accepted token set drifts from the
// other's — which is the actual C-3 risk.
const BOOLEAN_QUERY_DTOS: readonly [
  string,
  ClassConstructor<object>,
  string,
][] = [
  ['MessageListQueryDto', MessageListQueryDto, 'isRead'],
  ['AdminProjectListQueryDto', AdminProjectListQueryDto, 'featured'],
];

describe.each(BOOLEAN_QUERY_DTOS)(
  '%s boolean query parsing',
  (_name, Dto, field) => {
    // Errors are scoped to the field under test: these DTOs carry unrelated required members
    // (pagination, locale) whose errors say nothing about boolean parsing. Asserting on the whole
    // list would make every case fail for the wrong reason — and the rejection cases pass vacuously.
    const parse = (raw: Record<string, unknown>) => {
      const instance = plainToInstance(Dto, raw, {
        enableImplicitConversion: false,
      });
      return {
        value: (instance as unknown as Record<string, unknown>)[field],
        fieldErrors: validateSync(instance, { whitelist: true }).filter(
          (error) => error.property === field,
        ),
      };
    };

    it.each([
      ['true', true],
      ['false', false],
    ])('accepts %p as %p', (raw, expected) => {
      const { value, fieldErrors } = parse({ [field]: raw });
      expect(value).toBe(expected);
      expect(fieldErrors).toHaveLength(0);
    });

    it('treats an absent value as absent, not as false', () => {
      const { value, fieldErrors } = parse({});
      expect(value).toBeUndefined();
      expect(fieldErrors).toHaveLength(0);
    });

    // The strictness that must NOT be relaxed to match the config helper.
    it.each([['TRUE'], [' true '], ['1'], ['yes']])(
      'rejects the non-contract token %p with a validation error on the field itself',
      (raw) => {
        const { value, fieldErrors } = parse({ [field]: raw });
        // Left untouched by the transform, then rejected — never coerced to a boolean.
        expect(value).toBe(raw);
        expect(fieldErrors).not.toHaveLength(0);
        expect(fieldErrors[0]?.constraints).toHaveProperty('isBoolean');
      },
    );
  },
);

// The deliberate asymmetry (C-3). If someone "unifies" the two helpers, exactly one of these two
// blocks breaks — which is the signal, not a nuisance.
describe('config boolean parsing stays deliberately more tolerant', () => {
  // A COMPLETE, otherwise-valid environment (mirrors `env.validation.spec.ts`). This matters: with
  // an incomplete base, the rejection cases below would throw for unrelated missing variables and
  // pass vacuously — proving nothing about `SMTP_ENABLED` at all.
  const baseEnv = (): Record<string, string> => ({
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

  // Guards the guard: the base must be valid on its own, or every rejection below is vacuous.
  it('has a base environment that validates without SMTP_ENABLED', () => {
    expect(() => validateEnv(baseEnv())).not.toThrow();
  });

  it.each([
    ['true', true],
    ['TRUE', true],
    [' true ', true],
    ['  TrUe  ', true],
    ['false', false],
    ['FALSE', false],
    [' false ', false],
  ])('accepts the operator-typed spelling %p as %p', (raw, expected) => {
    // Only the parse result matters here; the mail group's other requirements are covered by
    // env.validation.spec.ts. A `true` value pulls in required SMTP_* fields, so supply them.
    const env = {
      ...baseEnv(),
      SMTP_ENABLED: raw,
      ...(expected
        ? {
            SMTP_HOST: 'smtp.example.com',
            SMTP_PORT: '465',
            SMTP_USER: 'user',
            SMTP_PASSWORD: 'pass',
            SMTP_FROM: 'noreply@example.com',
            CONTACT_NOTIFICATION_TO: 'owner@example.com',
          }
        : {}),
    };
    expect(validateEnv(env).SMTP_ENABLED).toBe(expected);
  });

  // Tolerance is about WHITESPACE AND CASE ONLY — never about vocabulary. `SMTP_ENABLED=no` must
  // still abort boot rather than reading as JS-truthy and silently enabling mail.
  it.each([['no'], ['1'], ['0'], ['yes'], ['on']])(
    'still aborts boot on the non-canonical value %p',
    (raw) => {
      expect(() => validateEnv({ ...baseEnv(), SMTP_ENABLED: raw })).toThrow(
        /SMTP_ENABLED/,
      );
    },
  );
});
