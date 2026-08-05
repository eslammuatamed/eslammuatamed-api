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

/** The SiteSettings singleton every valid plan must carry exactly once (see validatePlan). */
const SETTINGS_RECORD = {
  model: 'SiteSettings',
  action: 'unchanged',
  naturalKey: 'singleton',
  id: 'settings-1',
  fields: [],
} as RecordChange;

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
    expect(() =>
      validatePlan(basePlan({ records: [SETTINGS_RECORD, record()] })),
    ).not.toThrow();
  });

  it('accepts a plan whose only record is the settings singleton', () => {
    // The no-op shape: nothing to do, but the singleton is still named.
    expect(() =>
      validatePlan(basePlan({ records: [SETTINGS_RECORD] })),
    ).not.toThrow();
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

  it('rejects a plan that omits the SiteSettings singleton', () => {
    // Without this, the apply path's create branch would produce a SECOND settings row, which
    // would falsify doc 09 §6.1's "never created twice". The builder always emits the record, so
    // only a hand-edited --json plan reaches here — but a guarantee worth stating is worth
    // enforcing rather than qualifying.
    expect(() => validatePlan(basePlan({ records: [record()] }))).toThrow(
      /names it 0 time\(s\)/,
    );
  });

  it('rejects a plan that names the SiteSettings singleton twice', () => {
    expect(() =>
      validatePlan(
        basePlan({
          records: [
            record({ model: 'SiteSettings', naturalKey: 'singleton' }),
            record({ model: 'SiteSettings', naturalKey: 'singleton' }),
          ],
        }),
      ),
    ).toThrow(/names it 2 time\(s\)/);
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

  it('does NOT classify an unrelated error that merely contains the digits 40001', () => {
    // An id, a byte count, or a line of governed article content can contain those digits. Calling
    // that a transaction conflict would tell the operator a specific, wrong story — and promise
    // that retrying is safe — about an error that is neither.
    expect(
      isTransactionConflict(
        new Error('Article body exceeded 40001 characters at offset 12'),
      ),
    ).toBe(false);
    expect(
      isTransactionConflict(new Error('skill id 40001-abc not found')),
    ).toBe(false);
  });

  it('recognises a deadlock', () => {
    expect(isTransactionConflict(new Error('deadlock detected'))).toBe(true);
  });

  it('recognises the SQLSTATE when it appears as a code', () => {
    expect(isTransactionConflict(new Error('SQLSTATE 40001'))).toBe(true);
    expect(isTransactionConflict(new Error('code: 40P01'))).toBe(true);
  });

  it('recognises a raw Postgres serialization failure', () => {
    expect(
      isTransactionConflict(
        new Error('could not serialize access due to concurrent update'),
      ),
    ).toBe(true);
  });

  it('does not swallow an unrelated error', () => {
    expect(isTransactionConflict(new Error('null constraint violated'))).toBe(
      false,
    );
  });

  it("says none of THIS RUN'S changes were applied, and that retrying is safe", () => {
    // The message is the deliverable here: it is read mid-release, by someone deciding whether
    // the database is half-written. Both facts must be unmissable.
    const message = new TransactionConflictError(new Error('x')).message;

    expect(message).toMatch(/NONE OF THIS RUN'S CHANGES WERE APPLIED/);
    expect(message).toMatch(/rolled back in full/);
    expect(message).toMatch(/Retrying is safe/);
    expect(message).toMatch(/idempotent/);
  });

  it('does NOT claim the database is unchanged — it demonstrably is not', () => {
    // This guards a real defect that shipped in an earlier revision: the message said "the
    // database is exactly as it was before the run". That is false, and falsest exactly here — a
    // conflict occurs BECAUSE another session committed a write. An operator who believed it
    // would skip investigating a concurrent change to governed content, at the one moment an
    // accurate statement matters most.
    const message = new TransactionConflictError(new Error('x')).message;

    // The literal phrase that shipped, and any affirmative restatement of it. Written as a
    // negative lookbehind rather than a bare `/database is unchanged/` because the CORRECT message
    // contains that phrase — negated. A guard that forbade the words outright would fail on the
    // very wording it is meant to protect.
    expect(message).not.toMatch(/exactly as it was/i);
    expect(message).not.toMatch(
      /(?<!does NOT mean )the database is unchanged/i,
    );
    expect(message).not.toMatch(/nothing (has )?changed/i);

    // ...and it must say so positively, not merely omit the falsehood. Silence would leave the
    // operator to assume the reassuring reading.
    expect(message).toMatch(/does NOT mean the database is unchanged/);
    expect(message).toMatch(/another session committed a write/i);
  });

  it('tells the operator to READ the new plan, not just re-apply', () => {
    // The new plan may legitimately differ from the reviewed one, which is the whole reason this
    // is not retried automatically.
    const message = new TransactionConflictError(new Error('x')).message;

    expect(message).toMatch(/read the new plan before applying/i);
    expect(message).toMatch(/not retried automatically/);
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

  it('does not present the plan-time counts as the pair apply verifies', () => {
    // They are two different reads — the plan's, and apply's in-transaction pair — and on a live
    // database they can legitimately differ. Calling them one pair overstates what this proves.
    const text = renderPlan(basePlan());

    expect(text).not.toMatch(/counted before and re-verified after apply/);
    expect(text).toMatch(
      /apply re-verifies its own pair inside the transaction/,
    );
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
