import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SETTINGS_SCALARS,
  SETTINGS_TRANSLATIONS,
} from '../../../prisma/content/canonical/site-settings';
import { loadApiSpec } from '../../../test/utils/contract';
import { PUBLIC_SITE_SETTINGS_RESPONSE_EXAMPLES } from './site-settings.examples';

/**
 * The `/settings/site` response examples are the ONLY locale-representative payloads in the
 * contract, and the web repository's contract harness selects between them with
 * `Prefer: example=<name>`. Two things therefore have to hold, and neither is visible from the
 * schema alone:
 *
 * 1. THE EXAMPLES MUST BE COMPLETE AND VALID. Prism replays an example verbatim, so a missing or
 *    mistyped field is served to every gate that runs against the contract — it does not fail at
 *    export time. They are validated here against the exported document with the SAME oracle the
 *    e2e contract suite registers in `test/utils/contract.ts`, rather than a hand-rolled shape
 *    check.
 *
 * 2. THE GOVERNED VALUES MUST BE THE CANONICAL ONES. `src/` cannot import the canonical dataset —
 *    `tsconfig.build.json` excludes `prisma/`, so a runtime import would restructure `dist/` and
 *    break `start:prod`. The literals therefore live in `site-settings.examples.ts` and are
 *    COUPLED TO THE CANONICAL DATASET HERE instead: jest's `roots` includes `<rootDir>/../prisma`,
 *    and a spec is excluded from the build, so this file may import what the module may not.
 *    Mutating either localized site name fails this spec — which is the guard the contract
 *    example otherwise would not have, and exactly the failure mode this guards (a stale literal
 *    nothing could notice).
 */

const CONTRACT_PATH = join(__dirname, '..', '..', '..', 'openapi.json');
const SETTINGS_PATH = '/api/v1/settings/site';

interface OpenApiDocument {
  paths: Record<
    string,
    {
      get: {
        responses: Record<
          string,
          {
            content: Record<
              string,
              {
                examples?: Record<string, { summary?: string; value: unknown }>;
              }
            >;
          }
        >;
      };
    }
  >;
}

const document = JSON.parse(
  readFileSync(CONTRACT_PATH, 'utf8'),
) as OpenApiDocument;

const committedExamples =
  document.paths[SETTINGS_PATH]?.get.responses['200']?.content[
    'application/json'
  ]?.examples;

const canonical = (locale: string) => {
  const row = SETTINGS_TRANSLATIONS.find((entry) => entry.locale === locale);
  if (!row)
    throw new Error(`No canonical settings translation for "${locale}".`);
  return row;
};

describe('GET /settings/site — named locale response examples', () => {
  describe('the committed contract', () => {
    it('exposes named EN and AR response examples', () => {
      expect(committedExamples).toBeDefined();
      expect(Object.keys(committedExamples!).sort()).toEqual(['ar', 'en']);
    });

    it('serves the English site name from the EN example', () => {
      const value = committedExamples!.en!.value as {
        data: { siteName: string };
      };
      expect(value.data.siteName).toBe('Eslam Muatamed');
    });

    it('serves the Arabic site name from the AR example', () => {
      const value = committedExamples!.ar!.value as {
        data: { siteName: string };
      };
      expect(value.data.siteName).toBe('إسلام معتمد');
    });

    // The whole defect this change fixes: Prism synthesised BOTH locales from the same
    // locale-blind schema property examples, so `?locale=ar` was served the English name and
    // `/ar/resume` rendered a Latin `h1` under an Arabic font stack.
    it('does not serve the same site name for both locales', () => {
      const en = (
        committedExamples!.en!.value as { data: { siteName: string } }
      ).data.siteName;
      const ar = (
        committedExamples!.ar!.value as { data: { siteName: string } }
      ).data.siteName;
      expect(ar).not.toBe(en);
    });

    // The committed artifact must be what the module declares — i.e. `contract:export` was run and
    // its output committed. CI additionally re-exports and diffs (ci.yml), which is the other half
    // of the fixed-point proof; this half fails fast, in the unit lane, without booting Nest.
    it('matches the examples this module declares', () => {
      expect(committedExamples).toEqual(PUBLIC_SITE_SETTINGS_RESPONSE_EXAMPLES);
    });
  });

  describe('schema conformance', () => {
    beforeAll(() => {
      // The single repo-owned registration boundary (test/utils/contract.ts): structural
      // validation plus the enforced response formats, identical to every e2e assertion.
      loadApiSpec();
    });

    it.each(['en', 'ar'])(
      'the %s example satisfies the documented 200 response schema',
      (name) => {
        const response = {
          status: 200,
          req: { method: 'GET', path: SETTINGS_PATH },
          body: PUBLIC_SITE_SETTINGS_RESPONSE_EXAMPLES[name as 'en' | 'ar']
            .value,
        };
        expect(response).toSatisfyApiSpec();
      },
    );

    // Proves this spec runs the format-enforcing evaluator rather than a bypassed
    // registration: only the repo-owned matcher rejects `format: uuid` violations.
    it('rejects a cloned example whose portraitAssetId violates format uuid', () => {
      const corrupted = structuredClone(
        PUBLIC_SITE_SETTINGS_RESPONSE_EXAMPLES.en.value,
      ) as { data: Record<string, unknown> };
      corrupted.data.portraitAssetId = 'not-a-uuid';
      expect(() =>
        expect({
          status: 200,
          req: { method: 'GET', path: SETTINGS_PATH },
          body: corrupted,
        }).toSatisfyApiSpec(),
      ).toThrow(/must match format "uuid"/);
    });
  });

  describe('the governed values are the canonical ones', () => {
    it.each(['en', 'ar'])(
      'the %s example carries the canonical localized identity',
      (locale) => {
        const row = canonical(locale);
        const { data } =
          PUBLIC_SITE_SETTINGS_RESPONSE_EXAMPLES[locale as 'en' | 'ar'].value;

        expect(data.siteName).toBe(row.siteName);
        expect(data.tagline).toBe(row.tagline);
        expect(data.availabilityStatus).toBe(row.availabilityStatus);
        expect(data.defaultMetaTitle).toBe(row.defaultMetaTitle);
        expect(data.defaultMetaDescription).toBe(row.defaultMetaDescription);
        expect(data.aboutBio).toBe(row.aboutBio);
        expect(data.engineeringPhilosophy).toBe(row.engineeringPhilosophy);
        expect(data.currentFocus).toBe(row.currentFocus);
      },
    );

    it.each(['en', 'ar'])(
      'the %s example carries the canonical governed scalars',
      (locale) => {
        const { data } =
          PUBLIC_SITE_SETTINGS_RESPONSE_EXAMPLES[locale as 'en' | 'ar'].value;

        expect(data.profileLinks).toEqual(SETTINGS_SCALARS.profileLinks);
        expect(data.careerStartYear).toBe(SETTINGS_SCALARS.careerStartYear);
        expect(data.careerStartMonth).toBe(SETTINGS_SCALARS.careerStartMonth);
        expect(data.professionalEmail).toBe(SETTINGS_SCALARS.professionalEmail);
        expect(data.contactEmail).toBe(SETTINGS_SCALARS.contactEmail);
        expect(data.contactPhone).toBe(SETTINGS_SCALARS.contactPhone);
        expect(data.whatsappPhone).toBe(SETTINGS_SCALARS.whatsappPhone);
      },
    );

    // D10-6: locale completeness, no cross-locale fallback. `availableLocales` advertises exactly
    // the locales the canonical dataset actually translates, so the two cannot drift.
    it('advertises exactly the canonical locales', () => {
      const locales = SETTINGS_TRANSLATIONS.map((row) => row.locale);
      for (const name of ['en', 'ar'] as const) {
        expect(
          PUBLIC_SITE_SETTINGS_RESPONSE_EXAMPLES[name].value.data
            .availableLocales,
        ).toEqual(locales);
      }
    });
  });
});
