// Canonical article Tags (doc 09 §6.1). Natural key: the ENGLISH `TagTranslation.slug`.
// `key` is the dataset-internal handle articles link by; it is not stored.

export interface TagSeed {
  readonly key: string; // lookup key for articles
  readonly en: { readonly name: string; readonly slug: string };
  readonly ar: { readonly name: string; readonly slug: string };
}

export const TAGS: readonly TagSeed[] = [
  {
    key: 'nuxt',
    en: { name: 'Nuxt', slug: 'nuxt' },
    ar: { name: 'Nuxt', slug: 'nuxt' },
  },
  {
    key: 'i18n',
    en: { name: 'i18n', slug: 'i18n' },
    ar: { name: 'التعريب', slug: 'i18n' },
  },
  {
    key: 'vue',
    en: { name: 'Vue.js', slug: 'vue' },
    ar: { name: 'Vue.js', slug: 'vue' },
  },
  {
    key: 'performance',
    en: { name: 'Performance', slug: 'performance' },
    ar: { name: 'الأداء', slug: 'performance' },
  },
  {
    key: 'nestjs',
    en: { name: 'NestJS', slug: 'nestjs' },
    ar: { name: 'NestJS', slug: 'nestjs' },
  },
  {
    key: 'typescript',
    en: { name: 'TypeScript', slug: 'typescript' },
    ar: { name: 'TypeScript', slug: 'typescript' },
  },
  {
    key: 'ci-cd',
    en: { name: 'CI/CD', slug: 'ci-cd' },
    ar: { name: 'التكامل والنشر المستمر', slug: 'ci-cd' },
  },
  {
    key: 'security',
    en: { name: 'Security', slug: 'security' },
    ar: { name: 'الأمان', slug: 'security' },
  },
  {
    key: 'testing',
    en: { name: 'Testing', slug: 'testing' },
    ar: { name: 'الاختبارات', slug: 'testing' },
  },
  {
    key: 'rtl',
    en: { name: 'RTL', slug: 'rtl' },
    ar: { name: 'الاتجاه من اليمين إلى اليسار (RTL)', slug: 'rtl' },
  },
  {
    key: 'accessibility',
    en: { name: 'Accessibility', slug: 'accessibility' },
    ar: { name: 'إتاحة الوصول', slug: 'accessibility' },
  },
  {
    key: 'design-systems',
    en: { name: 'Design Systems', slug: 'design-systems' },
    ar: { name: 'أنظمة التصميم', slug: 'design-systems' },
  },
];
