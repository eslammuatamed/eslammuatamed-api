import { Prisma } from '@prisma/client';
import {
  assertProtectedCountsUnchanged,
  isTransactionConflict,
  PlanRejectedError,
  TransactionConflictError,
  validatePlan,
} from './apply-plan';
import { renderPlan, renderPlanJson, renderValue } from './report';
import type { Plan, RecordChange } from './types';

const basePlan = (overrides: Partial<Plan> = {}): Plan => ({
  records: [],
  relations: [],
  cascades: [],
  protectedCounts: { User: 1, ContactMessage: 3 },
  problems: [],
  ...overrides,
});

const record = (overrides: Partial<RecordChange> = {}): RecordChange => ({
  model: 'Project',
  action: 'update',
  naturalKey: 'personal-platform',
  id: 'project-1',
  fields: [],
  ...overrides,
});

describe('validatePlan — the gate every apply must pass', () => {
  it('accepts a well-formed plan', () => {
    expect(() => validatePlan(basePlan({ records: [record()] }))).not.toThrow();
  });

  it('rejects a plan naming a protected model', () => {
    const plan = basePlan({
      records: [record({ model: 'ContactMessage' as RecordChange['model'] })],
    });

    expect(() => validatePlan(plan)).toThrow(PlanRejectedError);
    expect(() => validatePlan(plan)).toThrow(/not in the governed allowlist/);
  });

  it.each([
    'User',
    'Role',
    'RolePermission',
    'RefreshToken',
    'ContactMessage',
    'MediaAsset',
    'Testimonial',
    'PageSeo',
    'SlugRedirect',
    'Locale',
  ])('rejects a plan that names the protected model %s', (model) => {
    expect(() =>
      validatePlan(
        basePlan({
          records: [record({ model: model as RecordChange['model'] })],
        }),
      ),
    ).toThrow(PlanRejectedError);
  });

  it('rejects a direct write to a cascade-only model', () => {
    // These may appear as disclosed CASCADES, never as records the tool writes itself.
    expect(() =>
      validatePlan(
        basePlan({
          records: [record({ model: 'ProjectGalleryItem' })],
        }),
      ),
    ).toThrow(/cascade-only/);
  });

  it('rejects a non-create record that carries no row id', () => {
    expect(() =>
      validatePlan(
        basePlan({ records: [record({ action: 'delete', id: undefined })] }),
      ),
    ).toThrow(/carries no row id/);
  });

  it('rejects a plan that already reports problems', () => {
    expect(() =>
      validatePlan(basePlan({ problems: ['Locale "ar" is missing.'] })),
    ).toThrow(/Locale "ar" is missing/);
  });

  it('rejects a relation on a non-governed model', () => {
    expect(() =>
      validatePlan(
        basePlan({
          relations: [
            {
              model: 'MediaAsset' as RecordChange['model'],
              owner: 'x',
              added: ['a'],
              removed: [],
            },
          ],
        }),
      ),
    ).toThrow(/Relation model "MediaAsset" is not in the governed allowlist/);
  });

  it('rejects a cascade disclosure for a model that is not cascade-only', () => {
    expect(() =>
      validatePlan(
        basePlan({
          cascades: [{ model: 'Project', owner: 'x', count: 1, detail: ['a'] }],
        }),
      ),
    ).toThrow(/disclosed as a cascade but is not a cascade-only model/);
  });

  it('reports every reason at once rather than only the first', () => {
    try {
      validatePlan(
        basePlan({
          records: [
            record({ model: 'User' as RecordChange['model'] }),
            record({ action: 'delete', id: undefined, naturalKey: 'other' }),
          ],
        }),
      );
      fail('expected the plan to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(PlanRejectedError);
      expect(
        (error as PlanRejectedError).reasons.length,
      ).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('assertProtectedCountsUnchanged', () => {
  // This mechanism previously had NO coverage at all: deleting it left the whole suite green,
  // so doc 09 §6.1's "the protection is verified, not asserted" was itself asserted by nobody.
  it('passes when every protected count is unchanged', () => {
    expect(() =>
      assertProtectedCountsUnchanged(
        { User: 1, ContactMessage: 3 },
        { User: 1, ContactMessage: 3 },
      ),
    ).not.toThrow();
  });

  it('throws when a protected count drops — the case that means rows were destroyed', () => {
    expect(() =>
      assertProtectedCountsUnchanged(
        { User: 1, ContactMessage: 3 },
        { User: 1, ContactMessage: 0 },
      ),
    ).toThrow(/ContactMessage 3 → 0/);
  });

  it('throws when a protected count rises', () => {
    expect(() =>
      assertProtectedCountsUnchanged({ Testimonial: 2 }, { Testimonial: 3 }),
    ).toThrow(/Testimonial 2 → 3/);
  });

  it('names every drifted model, not just the first', () => {
    expect(() =>
      assertProtectedCountsUnchanged(
        { User: 1, ContactMessage: 3, MediaAsset: 5 },
        { User: 0, ContactMessage: 3, MediaAsset: 4 },
      ),
    ).toThrow(/User 1 → 0.*MediaAsset 5 → 4/);
  });

  it('says the transaction is rolled back, because it now can be', () => {
    // The message used to end "investigate before running again" — accurate when the check ran
    // after commit and the damage was already permanent. It runs inside the transaction now.
    expect(() =>
      assertProtectedCountsUnchanged({ User: 1 }, { User: 0 }),
    ).toThrow(/rolled back/);
  });
});

describe('transaction conflicts', () => {
  it('recognises Prisma P2034', () => {
    // The real error class, not a shape-alike: `isTransactionConflict` narrows with `instanceof`,
    // so a duck-typed object would pass this test while the production path fell through.
    const error = new Prisma.PrismaClientKnownRequestError('write conflict', {
      code: 'P2034',
      clientVersion: '6.19.0',
    });

    expect(isTransactionConflict(error)).toBe(true);
  });

  it('does not treat a different Prisma error code as a conflict', () => {
    expect(
      isTransactionConflict(
        new Prisma.PrismaClientKnownRequestError('unique violation', {
          code: 'P2002',
          clientVersion: '6.19.0',
        }),
      ),
    ).toBe(false);
  });

  it('recognises a raw Postgres serialization failure', () => {
    expect(
      isTransactionConflict(
        new Error('could not serialize access due to concurrent update'),
      ),
    ).toBe(true);
    expect(isTransactionConflict(new Error('40001'))).toBe(true);
  });

  it('does not swallow an unrelated error', () => {
    expect(isTransactionConflict(new Error('null constraint violated'))).toBe(
      false,
    );
  });

  it('tells the operator nothing was applied and that retrying is safe', () => {
    // The message is the deliverable here: it is read mid-release, by someone deciding whether
    // the database is half-written. Both facts must be unmissable.
    const message = new TransactionConflictError(new Error('x')).message;

    expect(message).toMatch(/NOTHING WAS APPLIED/);
    expect(message).toMatch(/Retrying is safe/);
    expect(message).toMatch(/idempotent/);
  });
});

describe('report rendering', () => {
  it('redacts a value whose field name looks like a secret', () => {
    expect(renderValue('passwordHash', 'argon2id$real')).toBe('«redacted»');
    expect(renderValue('apiKey', 'sk-live-1234')).toBe('«redacted»');
    expect(renderValue('title', 'Not a secret')).toBe('Not a secret');
  });

  it('redacts in the machine-readable form too', () => {
    const json = renderPlanJson(
      basePlan({
        records: [
          record({
            fields: [
              { field: 'sessionToken', before: 'abc', after: 'def' },
              { field: 'title', before: 'Old', after: 'New' },
            ],
          }),
        ],
      }),
    );

    expect(json).not.toContain('abc');
    expect(json).toContain('«redacted»');
    expect(json).toContain('New');
  });

  it('prints a hide as a hide, never as a delete', () => {
    const text = renderPlan(
      basePlan({
        records: [
          record({
            model: 'Skill',
            action: 'hide',
            naturalKey: 'jquery',
            id: 'skill-1',
            fields: [{ field: 'isPublic', before: true, after: false }],
          }),
        ],
      }),
    );

    expect(text).toContain('h Skill  jquery');
    expect(text).not.toMatch(/^- Skill/m);
  });

  it('states plainly when there is nothing to do', () => {
    expect(renderPlan(basePlan())).toContain(
      'No changes — the database already matches the canonical dataset',
    );
  });

  it('always lists the protected counts, even on a no-op plan', () => {
    const text = renderPlan(basePlan());

    expect(text).toContain('PROTECTED');
    expect(text).toMatch(/ContactMessage\s+3/);
  });

  it('discloses that a cascade leaves the MediaAsset alone', () => {
    const text = renderPlan(
      basePlan({
        cascades: [
          {
            model: 'ProjectGalleryItem',
            owner: 'old-project',
            count: 2,
            detail: ['g1', 'g2'],
          },
        ],
      }),
    );

    expect(text).toContain('CASCADES');
    expect(text).toContain(
      'The referenced MediaAsset rows are NOT deleted — only the governed relation goes.',
    );
  });

  it('refuses to call an unusable plan applicable', () => {
    const text = renderPlan(
      basePlan({
        records: [record()],
        problems: ['Two Project rows share the English slug "x".'],
      }),
    );

    expect(text).toContain('THIS PLAN CANNOT BE APPLIED');
    expect(text).not.toContain('Plan is applicable');
  });
});
