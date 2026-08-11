import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { USAGE_INCLUDE } from './media.service';

/**
 * C-6's public contract is that deleting a referenced `MediaAsset` answers **409 with `usages`** —
 * a body naming what still points at the asset. Two independent things have to agree for that to
 * be true, and nothing bound them together before Phase 12A:
 *
 *   1. the DATABASE decides whether the delete fails at all — a relation whose effective delete
 *      policy is `Restrict` is what turns `DELETE /admin/media/{id}` into a rejection;
 *   2. `USAGE_INCLUDE` decides what the 409 body can NAME — a relation missing from it is invisible
 *      to `buildUsages`.
 *
 * Add a new `Restrict` relation to `MediaAsset` and forget the second half, and the API answers
 * 409 with an incomplete `usages` list: the operator is told the asset is in use and cannot be
 * told where. That is a silent, type-clean regression — `tsc`, lint and every existing test pass.
 *
 * The two sides are read from genuinely different sources of truth: the delete policy from
 * `prisma/schema.prisma` (parsed here, never from a constant this repo also maintains), and the
 * reporting set from the ACTUAL `USAGE_INCLUDE` object the usages query is built with. A test
 * that re-declared the relation list by hand and compared it to itself could not detect drift in
 * either direction, which is exactly the failure mode this replaces.
 *
 * Scope: MediaAsset only. This is deliberately not a general schema-reflection framework.
 */

const SCHEMA_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'prisma',
  'schema.prisma',
);

/** A relation field on some model that points AT `MediaAsset`. */
interface ForwardRelation {
  /** The model the field is declared on, e.g. `Article`. */
  model: string;
  /** The field name on that model, e.g. `coverImage`. */
  field: string;
  /** `@relation("ArticleCover")`, when the relation is named. */
  relationName: string | null;
  /** `true` when the field type is `MediaAsset` rather than `MediaAsset?`. */
  required: boolean;
  /** The literal `onDelete:` argument, when one is written. */
  explicitOnDelete: string | null;
}

/** A back-relation field on `MediaAsset`, e.g. `articleCovers Article[] @relation("ArticleCover")`. */
interface BackRelation {
  field: string;
  targetModel: string;
  relationName: string | null;
}

function readSchema(): string {
  return readFileSync(SCHEMA_PATH, 'utf8');
}

/** Strips `//` comments so a relation mentioned in prose is never parsed as a declaration. */
function withoutComments(source: string): string {
  return source
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

function modelBlock(source: string, model: string): string {
  const match = new RegExp(`^model ${model} \\{$([\\s\\S]*?)^\\}$`, 'm').exec(
    source,
  );
  if (!match?.[1]) throw new Error(`model ${model} not found in schema.prisma`);
  return match[1];
}

function relationNameOf(attributes: string): string | null {
  return /@relation\(\s*"([^"]+)"/.exec(attributes)?.[1] ?? null;
}

/** Every field, on any model, whose type is `MediaAsset` or `MediaAsset?`. */
function forwardRelationsToMediaAsset(source: string): ForwardRelation[] {
  const relations: ForwardRelation[] = [];
  let currentModel: string | null = null;

  for (const raw of source.split('\n')) {
    const line = raw.trim();
    const modelStart = /^model (\w+) \{$/.exec(line);
    if (modelStart) {
      currentModel = modelStart[1] ?? null;
      continue;
    }
    if (line === '}') {
      currentModel = null;
      continue;
    }
    if (!currentModel || currentModel === 'MediaAsset') continue;

    // `<field>  MediaAsset[?]  <attributes…>` — the `[]` form is a back-relation and cannot
    // appear on a model other than MediaAsset for this type, so it is not matched here.
    const field = /^(\w+)\s+MediaAsset(\?)?\s+(.*)$/.exec(line);
    if (!field) continue;

    const attributes = field[3] ?? '';
    relations.push({
      model: currentModel,
      field: field[1] ?? '',
      relationName: relationNameOf(attributes),
      required: field[2] !== '?',
      explicitOnDelete: /onDelete:\s*(\w+)/.exec(attributes)?.[1] ?? null,
    });
  }
  return relations;
}

/**
 * The EFFECTIVE referential action, not merely the written one.
 *
 * Prisma applies a default when `onDelete` is omitted: `Restrict` for a required relation and
 * `SetNull` for an optional one. A grep for `onDelete: Restrict` therefore undercounts — a
 * required `MediaAsset` field with no `onDelete` at all blocks deletion just as hard. Deriving the
 * effective value here is what stops this invariant from being decorative.
 *
 * @see https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions
 */
function effectiveOnDelete(relation: ForwardRelation): string {
  if (relation.explicitOnDelete) return relation.explicitOnDelete;
  return relation.required ? 'Restrict' : 'SetNull';
}

/** Actions under which the database REFUSES to delete a referenced `MediaAsset`. */
const BLOCKING_ACTIONS = new Set(['Restrict', 'NoAction']);

function backRelationsOnMediaAsset(source: string): BackRelation[] {
  const relations: BackRelation[] = [];
  for (const raw of modelBlock(source, 'MediaAsset').split('\n')) {
    const line = raw.trim();
    const field = /^(\w+)\s+(\w+)\[\]\s*(.*)$/.exec(line);
    if (!field) continue;
    relations.push({
      field: field[1] ?? '',
      targetModel: field[2] ?? '',
      relationName: relationNameOf(field[3] ?? ''),
    });
  }
  return relations;
}

/** The `MediaAsset` back-relation field name a given forward relation is reachable through. */
function backRelationFor(
  forward: ForwardRelation,
  backRelations: readonly BackRelation[],
): string {
  const match = backRelations.find(
    (back) =>
      back.targetModel === forward.model &&
      back.relationName === forward.relationName,
  );
  if (!match) {
    throw new Error(
      `No MediaAsset back-relation matches ${forward.model}.${forward.field}` +
        `${forward.relationName ? ` ("${forward.relationName}")` : ''}. ` +
        'Either the relation name changed or the back-relation is missing.',
    );
  }
  return match.field;
}

function blockingBackRelationNames(source: string): string[] {
  const backRelations = backRelationsOnMediaAsset(source);
  return forwardRelationsToMediaAsset(source)
    .filter((relation) => BLOCKING_ACTIONS.has(effectiveOnDelete(relation)))
    .map((relation) => backRelationFor(relation, backRelations))
    .sort();
}

describe('MediaAsset delete-blocking relations are all reported as usages', () => {
  const source = withoutComments(readSchema());

  it('reports every relation that can make a media delete fail', () => {
    const blocking = blockingBackRelationNames(source);
    const reported = Object.keys(USAGE_INCLUDE).sort();

    // Asserted as an exact set equality in BOTH directions deliberately. A missing entry is the
    // C-6 defect (409 with an incomplete `usages`); an extra entry is a reporting claim the
    // database no longer backs, which is how a stale include survives a schema change.
    expect(blocking).toEqual(reported);
  });

  it('excludes the relations that cascade instead of blocking, so the set is not just "everything"', () => {
    // Guards the guard. `alts` and `variants` are `onDelete: Cascade` — they vanish with the
    // asset and can never make a delete fail, so they must NOT be in `USAGE_INCLUDE`. Without
    // this, an invariant that simply listed every back-relation on `MediaAsset` would pass the
    // test above while being a different (and wrong) rule.
    const backRelationFields = backRelationsOnMediaAsset(source).map(
      (relation) => relation.field,
    );
    expect(backRelationFields).toEqual(
      expect.arrayContaining(['alts', 'variants']),
    );
    expect(Object.keys(USAGE_INCLUDE)).not.toContain('alts');
    expect(Object.keys(USAGE_INCLUDE)).not.toContain('variants');
    expect(backRelationFields.length).toBeGreaterThan(
      Object.keys(USAGE_INCLUDE).length,
    );
  });

  it('derives the blocking set from effective policy, not from the literal onDelete text', () => {
    // The parser must agree with a `grep onDelete: Restrict` reading of the CURRENT schema — and
    // must keep working if a future relation relies on the required-field default instead. This
    // pins the first half by value so the derivation cannot silently start returning nothing:
    // an empty or near-empty blocking set would make the equality test above pass vacuously the
    // day `USAGE_INCLUDE` is emptied too.
    const explicitRestrict = forwardRelationsToMediaAsset(source).filter(
      (relation) => relation.explicitOnDelete === 'Restrict',
    );
    expect(blockingBackRelationNames(source)).toHaveLength(
      explicitRestrict.length,
    );
    expect(blockingBackRelationNames(source).length).toBeGreaterThanOrEqual(8);
  });
});
