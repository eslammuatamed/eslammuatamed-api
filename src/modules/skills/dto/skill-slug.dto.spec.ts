import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ProjectListQueryDto } from '../../projects/dto/project-query.dto';
import { CreateSkillDto, UpdateSkillDto } from './skill.dto';

// `slug` is a PUBLIC URL segment, so its format is part of the contract rather than a naming
// convention. These assertions pin the rule at the validation boundary — the only place that can
// keep a malformed slug out of the database in the first place.
const errorsFor = <T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
): string[] =>
  validateSync(plainToInstance(cls, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((error) => error.property);

const validSkill = {
  group: 'LANGUAGE',
  order: 0,
  translations: [{ locale: 'en', label: 'TypeScript' }],
};

describe('Skill slug contract', () => {
  describe('CreateSkillDto.slug', () => {
    it.each(['typescript', 'tailwind-css', 'requirements-analysis', 'a11y'])(
      'accepts lowercase kebab-case: %s',
      (slug) => {
        expect(errorsFor(CreateSkillDto, { ...validSkill, slug })).toEqual([]);
      },
    );

    // Each of these would produce a different public URL for the same skill, or a URL that is not
    // safely comparable — the exact ambiguity a stable identifier has to rule out.
    it.each([
      ['uppercase', 'TypeScript'],
      ['underscores', 'tailwind_css'],
      ['spaces', 'tailwind css'],
      ['a leading hyphen', '-vue'],
      ['a trailing hyphen', 'vue-'],
      ['doubled hyphens', 'vue--js'],
      ['a dot', 'node.js'],
      ['emptiness', ''],
    ])('rejects %s', (_case, slug) => {
      expect(errorsFor(CreateSkillDto, { ...validSkill, slug })).toContain(
        'slug',
      );
    });

    it('is required — a skill cannot exist without a public identity', () => {
      expect(errorsFor(CreateSkillDto, validSkill)).toContain('slug');
    });

    // A uuid satisfies the kebab-case rule, so without an explicit refusal a slug could be created
    // that `?technology=` would route to the id column forever and answer with an empty page. This
    // endpoint is the only place that can prevent it — the migration's mapping covers the rows that
    // already exist, not the ones an admin creates later.
    it('refuses a uuid-shaped slug, which the kebab-case rule alone would allow', () => {
      const uuidShaped = '019fa4e9-2810-7f82-a537-6e3ea8ddcc67';

      // Guard the premise: if this ever stops holding, the rule below is testing nothing.
      expect(uuidShaped).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);

      expect(
        errorsFor(CreateSkillDto, { ...validSkill, slug: uuidShaped }),
      ).toContain('slug');
    });

    // Not over-broad: hex-looking slugs that are not uuid-SHAPED stay legal.
    it.each(['abc123', 'a11y', 'web3', 'deadbeef'])(
      'still accepts the hex-looking but non-uuid slug %s',
      (slug) => {
        expect(errorsFor(CreateSkillDto, { ...validSkill, slug })).toEqual([]);
      },
    );
  });

  describe('UpdateSkillDto', () => {
    // Re-slugging breaks every shared and indexed filter URL already pointing at the skill, so it
    // is not a routine admin edit. Rejected outright rather than silently ignored, so a caller
    // that tries is told instead of believing it worked.
    it('refuses a slug change', () => {
      expect(errorsFor(UpdateSkillDto, { slug: 'renamed' })).toContain('slug');
    });

    it('still allows the editable, presentational half', () => {
      expect(
        errorsFor(UpdateSkillDto, {
          order: 3,
          translations: [{ locale: 'en', label: 'Renamed Label' }],
        }),
      ).toEqual([]);
    });
  });

  describe('ProjectListQueryDto.technology', () => {
    it('accepts a slug', () => {
      expect(errorsFor(ProjectListQueryDto, { technology: 'nestjs' })).toEqual(
        [],
      );
    });

    // Backward compatibility: links published before slugs existed carry a uuid and must not start
    // failing validation.
    it('accepts a legacy Skill uuid', () => {
      expect(
        errorsFor(ProjectListQueryDto, {
          technology: '019fa4e9-2810-7f82-a537-6e3ea8ddcc67',
        }),
      ).toEqual([]);
    });

    // An unknown-but-well-formed value is the service's business (it yields an empty page); only
    // malformed input is a validation failure.
    it('rejects a malformed technology value', () => {
      expect(
        errorsFor(ProjectListQueryDto, { technology: 'Node.js' }),
      ).toContain('technology');
    });

    it('treats the filter as optional', () => {
      expect(errorsFor(ProjectListQueryDto, {})).toEqual([]);
    });
  });
});
