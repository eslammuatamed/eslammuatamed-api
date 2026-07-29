// The approved public tagline (SiteSettingsTranslation.tagline), transcribed verbatim from the
// governed content source:
//
//   repository : eslammuatamed-docs
//   commit     : 64a0f07510171083d2c7c3b533a8d9bd3d78e198
//   file       : content/positioning-strategy.md  (Approved · v1.1.0 · 2026-07-29)
//   sections   : §2 "Approved canonical CMS tagline — English"
//                §3 "Approved canonical CMS tagline — Arabic"
//
// These supersede the pre-v1.0.0 values (`Frontend Engineer — Vue.js & Nuxt.js` and its Arabic
// counterpart), which still carried the superseded primary title.
//
// ONE VALUE, SEVERAL CONSUMERS. §8 of that document records that the homepage hero, the footer,
// the public settings response and `Person.jobTitle` all render this one governed tagline, and
// that no surface may hard-code its own title. That is why the strings live here rather than
// beside any single consumer.
//
// Wording changes require owner review. Do not rewrite, normalise, translate or "fix" punctuation
// here — the em dash, the `&` in the English string, and the Arabic `و` prefix on `Nuxt.js` are all
// part of the approved bytes. `test/public-tagline.e2e-spec.ts` compares the values a seeded
// database actually holds against digests recorded independently of this module, so a typo fails
// CI rather than shipping.

export const PUBLIC_TAGLINE: Readonly<Record<'en' | 'ar', string>> = {
  en: 'JavaScript Product Engineer — Frontend Engineer specializing in Vue.js & Nuxt.js',
  ar: 'مهندس برمجيات للمنتجات — متخصص في هندسة الواجهات الأمامية باستخدام Vue.js وNuxt.js',
} as const;
