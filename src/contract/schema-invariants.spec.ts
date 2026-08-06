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
