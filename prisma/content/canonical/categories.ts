// Canonical article Categories (doc 09 §6.1). Natural key: the ENGLISH `CategoryTranslation.slug`.
// This is the same set the base production seed creates; the synchronization owns it from here.

export interface CategorySeed {
  readonly en: { readonly name: string; readonly slug: string };
  readonly ar: { readonly name: string; readonly slug: string };
}

export const CATEGORIES: readonly CategorySeed[] = [
  {
    en: { name: 'Engineering', slug: 'engineering' },
    ar: { name: 'هندسة', slug: 'handasa' },
  },
  {
    en: { name: 'Architecture', slug: 'architecture' },
    ar: { name: 'معمارية', slug: 'muemaria' },
  },
  {
    en: { name: 'Career', slug: 'career' },
    ar: { name: 'مسيرة مهنية', slug: 'masira-mihaniya' },
  },
  {
    en: { name: 'Tutorials', slug: 'tutorials' },
    ar: { name: 'شروحات', slug: 'shuruhat' },
  },
];
