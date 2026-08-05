import { PlanRejectedError, validatePlan } from './apply-plan';
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
