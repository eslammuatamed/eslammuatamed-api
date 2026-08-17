import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma } from '../../generated/prisma/client';
import { uniqueConstraintFields } from './prisma-error-metadata';

// F9-9. The v6-era spec for this behaviour constructed its own error with `meta.target` and
// asserted that value straight back, so it proved an implementation assumption rather than any
// real Prisma behaviour — and passed unchanged through a major version that broke it. The
// authoritative proof is therefore the real-database regression in
// `test/prisma-error-mapping.e2e-spec.ts`; this file covers the translation logic's branches and
// the schema invariant it rests on.
//
// The Prisma 7 fixtures below reproduce a shape observed against a real PostgreSQL, not an
// invented one. `test/prisma-error-mapping.e2e-spec.ts` pins that same shape against a live
// database, so if Prisma moves it again that test fails and names the new location.

const known = (meta: unknown): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: Prisma.prismaVersion.client,
    meta: meta as Record<string, unknown>,
  });

const adapterMeta = (fields: string[], modelName = 'CategoryTranslation') => ({
  modelName,
  driverAdapterError: {
    name: 'DriverAdapterError',
    cause: {
      originalCode: '23505',
      originalMessage: `duplicate key value violates unique constraint "..."`,
      kind: 'UniqueConstraintViolation',
      constraint: { fields },
    },
  },
});

describe('uniqueConstraintFields', () => {
  describe('A. Prisma 7 driver-adapter metadata → API field names', () => {
    it('converts a mapped snake_case column to its camelCase API name', () => {
      expect(
        uniqueConstraintFields(known(adapterMeta(['category_id']))),
      ).toEqual(['categoryId']);
    });

    it('converts a multi-underscore column', () => {
      expect(
        uniqueConstraintFields(known(adapterMeta(['site_settings_id']))),
      ).toEqual(['siteSettingsId']);
    });
  });

  describe('B. a field whose database and API names are identical', () => {
    it('returns it unchanged rather than mangling it', () => {
      expect(uniqueConstraintFields(known(adapterMeta(['slug'])))).toEqual([
        'slug',
      ]);
    });

    it('does not invent a nested DTO path for it', () => {
      // Prisma knows the FIELD collided; it does not know which request-body array element
      // carried it. `translations[0].slug` would be a guess this boundary cannot justify.
      const fields = uniqueConstraintFields(known(adapterMeta(['slug'])));
      expect(fields).not.toContain('translations[0].slug');
      expect(fields?.every((f) => !f.includes('[') && !f.includes('.'))).toBe(
        true,
      );
    });
  });

  describe('C. multiple fields', () => {
    it('translates each element and preserves order', () => {
      expect(
        uniqueConstraintFields(known(adapterMeta(['category_id', 'locale']))),
      ).toEqual(['categoryId', 'locale']);
    });

    it('handles the composite slug constraint', () => {
      expect(
        uniqueConstraintFields(known(adapterMeta(['locale', 'slug']))),
      ).toEqual(['locale', 'slug']);
    });
  });

  describe('D. missing or unrecognized metadata → null, never a placeholder', () => {
    it.each([
      ['undefined meta', undefined],
      ['empty meta', {}],
      ['model name only', { modelName: 'CategoryTranslation' }],
      [
        'adapter error with no constraint',
        { driverAdapterError: { cause: {} } },
      ],
      ['constraint with no fields', adapterMeta([] as string[])],
      ['fields of the wrong type', adapterMeta([1, 2] as unknown as string[])],
      ['null target', { target: null }],
    ])('returns null for %s', (_label, meta) => {
      expect(uniqueConstraintFields(known(meta))).toBeNull();
    });

    it('rejects a bare constraint-name string instead of publishing it as a field', () => {
      // Prisma documents `target` as sometimes being a constraint name. That is not a field, and
      // leaking it would both mislead the client and expose the database naming scheme.
      expect(
        uniqueConstraintFields(
          known({ target: 'article_translations_locale_slug_key' }),
        ),
      ).toBeNull();
    });

    it('never returns the literal "unknown"', () => {
      // The pre-F9-9 fallback. Asserted explicitly so it cannot quietly return.
      for (const meta of [undefined, {}, { target: 'some_constraint' }]) {
        const fields = uniqueConstraintFields(known(meta));
        // null (omit `errors` entirely) is the contract — never an array carrying a placeholder.
        expect(fields ?? []).not.toContain('unknown');
        expect(fields).toBeNull();
      }
    });
  });

  describe('E. no driver internals escape', () => {
    it('returns only field names, never the constraint name or adapter structure', () => {
      const fields = uniqueConstraintFields(
        known(adapterMeta(['category_id'])),
      );
      const serialized = JSON.stringify(fields);
      expect(serialized).not.toContain('driverAdapterError');
      expect(serialized).not.toContain('constraint');
      expect(serialized).not.toContain('23505');
      expect(serialized).not.toContain('duplicate key');
      expect(serialized).not.toContain('_');
    });
  });

  // Kept, but deliberately secondary: the v7 adapter shape above is the one that actually occurs.
  describe('legacy meta.target compatibility', () => {
    it('still translates a string array', () => {
      expect(
        uniqueConstraintFields(known({ target: ['category_id', 'locale'] })),
      ).toEqual(['categoryId', 'locale']);
    });
  });
});

// The helper's snake_case→camelCase translation is only sound because the schema is mechanical.
// Asserting that here means a future non-mechanical `@map` on a unique field FAILS THIS TEST
// instead of silently publishing a wrong field path.
describe('the schema invariant the translation rests on', () => {
  const snake = (name: string): string =>
    name.replace(/(?<!^)(?=[A-Z])/g, '_').toLowerCase();

  it('gives every unique-constraint field either a mechanical @map or none', () => {
    const schema = readFileSync(
      join(__dirname, '../../../prisma/schema.prisma'),
      'utf8',
    );
    const models = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
    expect(models.length).toBeGreaterThan(0);

    const offenders: string[] = [];

    for (const match of models) {
      const modelName = match[1] ?? '';
      const body = match[2] ?? '';
      const uniqueFields = new Set<string>();
      const mapped = new Map<string, string>();

      for (const raw of body.split('\n')) {
        const line = raw.trim();
        if (line === '' || line.startsWith('//')) continue;

        const compound = /^@@unique\(\[([^\]]+)\]/.exec(line);
        if (compound?.[1] !== undefined) {
          for (const field of compound[1].split(','))
            uniqueFields.add(field.trim());
          continue;
        }
        if (line.startsWith('@@')) continue;

        const field = /^(\w+)\s+\S+/.exec(line);
        const name = field?.[1];
        if (name === undefined) continue;
        const map = /@map\("([^"]+)"\)/.exec(line);
        if (map?.[1] !== undefined) mapped.set(name, map[1]);
        if (/(?<!@)@unique/.test(line)) uniqueFields.add(name);
      }

      for (const name of uniqueFields) {
        const column = mapped.get(name);
        if (column !== undefined && column !== snake(name)) {
          offenders.push(
            `${modelName}.${name} → @map("${column}") (expected "${snake(name)}")`,
          );
        }
      }
    }

    // Audited 2026-08-10: 41 unique-constraint fields — 19 with a mechanical @map, 22 with none.
    expect(offenders).toEqual([]);
  });
});
