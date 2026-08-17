import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Contract invariants asserted over the EXPORTED OpenAPI document (doc 16 §3).
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────
 *
 * `SettingsTranslationDto.portraitAlt` (D09-22) shipped exporting `{"type":"object"}` while every
 * sibling nullable string in the same DTO exported `{"type":"string"}`. Swagger infers a schema from
 * the TypeScript design type emitted by the decorator metadata, and a `string | null` UNION erases to
 * `Object` — so the union alone produces the wrong type unless `type:` is stated explicitly.
 *
 * Nothing caught it. The runtime was correct (`@IsString()`, `@MaxLength()`, the null `ValidateIf`),
 * every validator matched the house idiom, and no test asserted the exported schema of any field.
 * The damage only appeared one repository away: `openapi-typescript` turned it into
 * `Record<string, never> | null`, a type no caller can assign a string to, which made the per-usage
 * About alt unwritable from the Dashboard — and the Web is forbidden from handwriting a correction.
 *
 * A review that checks the validators and concludes "matches convention" cannot find this, because
 * the validators DO match; the wrong axis was compared. That is precisely the kind of rule that has
 * to be structural rather than remembered, so this asserts it over the whole document rather than
 * over the one field that happened to be noticed.
 *
 * ── THE INVARIANT ───────────────────────────────────────────────────────────────────────────────
 *
 * A property that declares `type: object` must actually DESCRIBE an object — via `properties`,
 * `additionalProperties`, `$ref`, or a composition keyword. A BARE `{"type":"object"}` carrying
 * nothing but scalar facets (`example`, `format`, `nullable`, `minimum`, …) is not a description of
 * an object at all; it is the fingerprint of an erased union.
 *
 * Stated that way it is generic over the schema: any future `string | null`, `number | null` or
 * `Date | null` field is covered the day it is added, in any module, with nobody needing to recall
 * this incident.
 */

const CONTRACT: unknown = JSON.parse(
  readFileSync(join(process.cwd(), 'openapi.json'), 'utf8'),
);

/** Keywords that make a `type: object` schema an actual object description rather than an erasure. */
const OBJECT_DESCRIBING_KEYWORDS = [
  'properties',
  'additionalProperties',
  '$ref',
  'allOf',
  'oneOf',
  'anyOf',
] as const;

/**
 * The ONE deliberate bare `type: object` in the document.
 *
 * `ProblemDetailsDto.usages` is an RFC 7807 extension member typed `readonly unknown[]` — the
 * references blocking a 409 delete. Its looseness is hand-written and intentional (doc 10 §6), not
 * an erasure: there is no TypeScript union behind it to have been lost. It is allowlisted BY PATH so
 * that a second bare object appearing anywhere else still fails, and so that removing the field
 * makes this entry visibly stale rather than silently permissive.
 */
const DELIBERATE_BARE_OBJECTS = new Set<string>([
  'components.schemas.ProblemDetailsDto.properties.usages.items',
]);

interface Offender {
  readonly path: string;
  readonly facets: readonly string[];
  readonly example: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every bare `type: object` node in the document, by JSON path. */
function findBareObjectSchemas(root: unknown): Offender[] {
  const offenders: Offender[] = [];

  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((child, index) => walk(child, `${path}[${index}]`));
      return;
    }
    if (!isRecord(node)) return;

    if (
      node.type === 'object' &&
      !OBJECT_DESCRIBING_KEYWORDS.some((keyword) => node[keyword] !== undefined)
    ) {
      offenders.push({
        path,
        facets: Object.keys(node).filter((key) => key !== 'type'),
        example: node.example,
      });
    }

    for (const [key, value] of Object.entries(node))
      walk(value, `${path}.${key}`);
  };

  walk(root, 'components');
  return offenders;
}

const bareObjects = findBareObjectSchemas(
  (CONTRACT as { components?: unknown }).components,
);

describe('exported contract — a nullable scalar must never erase to `type: object`', () => {
  it('finds schemas to inspect at all', () => {
    // Guards the guard. A path typo or a restructured document would make every assertion below
    // vacuously true, which is the failure mode a contract invariant can least afford.
    const schemas = (
      CONTRACT as { components: { schemas: Record<string, unknown> } }
    ).components.schemas;
    expect(Object.keys(schemas).length).toBeGreaterThan(50);
    expect(schemas.SettingsTranslationDto).toBeDefined();
  });

  it('declares no BARE `type: object` outside the documented exceptions', () => {
    const unexpected = bareObjects.filter(
      (offender) => !DELIBERATE_BARE_OBJECTS.has(offender.path),
    );

    // The message names the field AND the likely intent, because the fix is a one-word
    // `type: String` / `type: Number` on the `@ApiProperty*` decorator and the reader should not
    // have to rediscover that.
    expect(
      unexpected.map(
        (o) =>
          `${o.path} (facets: ${o.facets.join(', ')}; example: ${JSON.stringify(o.example)})`,
      ),
    ).toEqual([]);
  });

  it('never pairs `type: object` with a PRIMITIVE example — the sharpest signature of an erasure', () => {
    // A schema claiming to be an object while showing `"#3178C6"` or `2026` as its example is
    // self-contradicting on its face. Kept as its own assertion because it produces a far more
    // obvious message than the general rule when both would fire.
    const contradictions = bareObjects
      .filter((o) => !DELIBERATE_BARE_OBJECTS.has(o.path))
      .filter((o) => o.example !== undefined && !isRecord(o.example))
      .map(
        (o) =>
          `${o.path} exports type:object but its example is ${JSON.stringify(o.example)}`,
      );

    expect(contradictions).toEqual([]);
  });

  it('exports every nullable field of SettingsTranslationDto as a real scalar type', () => {
    // The specific regression, kept alongside the general rule. The general rule would catch it, but
    // this one names D09-22 so a future reader knows which incident the invariant came from.
    const dto = (
      CONTRACT as {
        components: {
          schemas: {
            SettingsTranslationDto: {
              properties: Record<string, { type?: string }>;
            };
          };
        };
      }
    ).components.schemas.SettingsTranslationDto.properties;

    expect(dto.portraitAlt?.type).toBe('string');
    for (const [name, schema] of Object.entries(dto)) {
      expect(`${name}: ${schema.type ?? 'undefined'}`).not.toContain(
        ': object',
      );
    }
  });
});

/**
 * Second contract invariant (D10-23): READ and WRITE must agree on nullability.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────
 *
 * Sibling defect to the erasure above, found by the same kind of cross-axis comparison. Twenty-six
 * write-DTO fields exported as a plain `{"type":"string"}` while the entity that reads them back
 * exported `{"type":"string","nullable":true}`. The runtime accepted `null` and cleared the column —
 * `@IsOptional()` skips `null` as well as `undefined`, so the value passed the whitelist untouched
 * and reached Prisma, where `null` writes NULL and `undefined` is a no-op.
 *
 * So the contract described a system in which a cleared field could be OBSERVED but never CAUSED.
 * `openapi-typescript` rendered the write side `field?: string`, and the Web is forbidden from
 * handwriting a correction — meaning no strict-TS caller could withdraw a Google verification token,
 * empty a meta description, or remove an OG image, though the API would have honoured all three.
 *
 * Every validator matched the house idiom here too, which is exactly why this has to be structural.
 *
 * ── THE INVARIANT ───────────────────────────────────────────────────────────────────────────────
 *
 * If a field name is nullable anywhere on the read side, the same field name on a write DTO must
 * declare `nullable: true` — unless it is listed as a deliberate exception with a reason.
 *
 * Pairing is BY FIELD NAME rather than by traced read/write pairs. That is deliberately blunt: it
 * over-reports rather than under-reports, and an over-report is answered by one allowlist line
 * carrying its justification, whereas an under-report ships the defect. It is also how the original
 * sweep found all twenty-six.
 */
describe('exported contract — write DTOs must permit the nulls the read side reports', () => {
  /**
   * Fields that are legitimately non-nullable on write. Each is asserted to be a REAL asymmetry
   * below, so an entry that stops being necessary fails the suite instead of quietly permitting a
   * future regression — same staleness discipline as DELIBERATE_BARE_OBJECTS above.
   */
  const DELIBERATE_NON_NULLABLE = new Map<string, string>([
    [
      'LoginDto.email',
      'Authentication requires an address; `null` is rejected by @IsEmail() (no @IsOptional()). ' +
        'The name collides with the nullable User.email on the read side, nothing more.',
    ],
    [
      'CreateUserDto.email',
      'A user is created WITH an address; `null` is rejected by @IsEmail(). Same name collision.',
    ],
  ]);

  const schemas = (
    CONTRACT as {
      components: {
        schemas: Record<
          string,
          { properties?: Record<string, { nullable?: boolean }> }
        >;
      };
    }
  ).components.schemas;

  /** Field names any non-DTO (read) schema reports as nullable. */
  const nullableOnRead = new Set<string>();
  for (const [name, schema] of Object.entries(schemas)) {
    if (name.endsWith('Dto')) continue;
    for (const [field, property] of Object.entries(schema.properties ?? {}))
      if (property.nullable) nullableOnRead.add(field);
  }

  const asymmetric: string[] = [];
  for (const [name, schema] of Object.entries(schemas)) {
    if (!name.endsWith('Dto')) continue;
    for (const [field, property] of Object.entries(schema.properties ?? {}))
      if (nullableOnRead.has(field) && !property.nullable)
        asymmetric.push(`${name}.${field}`);
  }

  it('finds read-nullable fields and write DTOs to compare at all', () => {
    // Guards the guard: a restructured document would make the assertion below vacuously true.
    expect(nullableOnRead.size).toBeGreaterThan(10);
    expect(
      Object.keys(schemas).filter((name) => name.endsWith('Dto')).length,
    ).toBeGreaterThan(10);
    expect(nullableOnRead.has('metaTitle')).toBe(true);
  });

  it('declares no read/write nullability asymmetry outside the documented exceptions', () => {
    expect(
      asymmetric.filter((path) => !DELIBERATE_NON_NULLABLE.has(path)),
    ).toEqual([]);
  });

  it('carries no STALE exception — every allowlisted field is still a real asymmetry', () => {
    // An exception that has been fixed must be deleted, not left behind to mask the next regression.
    expect(
      [...DELIBERATE_NON_NULLABLE.keys()].filter(
        (path) => !asymmetric.includes(path),
      ),
    ).toEqual([]);
  });
});
