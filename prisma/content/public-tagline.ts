// The approved public tagline (SiteSettingsTranslation.tagline), transcribed verbatim from the
// governed content source:
//
//   repository : eslammuatamed-docs
//   commit     : 393c3897d02d65c18c1066288e53911aa71ec5f8
//   file       : content/positioning-strategy.md  (Approved · v2.0.0 · 2026-08-05)
//   sections   : §2 "Approved canonical CMS tagline"
//
// This supersedes the v1.1.0 pair (`JavaScript Product Engineer — Frontend Engineer specializing
// in Vue.js & Nuxt.js` and its Arabic counterpart), which carried the superseded primary title.
//
// TWO DELIBERATE PROPERTIES, BOTH OWNER-APPROVED:
//
// 1. THE SAME ENGLISH STRING IN BOTH LOCALES. The professional title is kept in English on the
//    Arabic site too (§3). This is not a missing translation and not a locale fallback — the
//    `ar` row holds this value on purpose. Every other localized field still differs per locale,
//    which is what continues to prove per-locale resolution is real.
//
// 2. THE NEWLINE IS PART OF THE APPROVED COPY. The title is a two-line composition:
//    `Full-Stack JavaScript` over `Product Engineer`. Storing the break here keeps §8's rule
//    intact — one governed value, several consumers, no surface hard-coding its own title.
//    HTML collapses the newline to a space everywhere except the hero, which opts in with
//    `white-space: pre-line`; the two JSON-LD `jobTitle` emitters normalise it back to a space.
//
// Wording changes require owner review. Do not rewrite, normalise, translate or "fix" this —
// including the newline. `test/public-tagline.e2e-spec.ts` compares the values a seeded database
// actually holds against digests recorded independently of this module, so a typo fails CI
// rather than shipping.

const APPROVED_TITLE = 'Full-Stack JavaScript\nProduct Engineer';

export const PUBLIC_TAGLINE: Readonly<Record<'en' | 'ar', string>> = {
  en: APPROVED_TITLE,
  ar: APPROVED_TITLE,
} as const;
