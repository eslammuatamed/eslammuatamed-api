// Canonical Skills taxonomy (doc 09 §6.1). Pure data — no database calls — so exactly one
// definition is shared by the production synchronization, the development overlay and the tests.
import { SkillGroup } from '../../../src/generated/prisma/client';

export interface SkillSeed {
  readonly group: SkillGroup;
  readonly order: number;
  readonly brandColor: string | null; // null where no brand color exists (e.g. practices)
  // The stable lookup key AND the project/experience link key — `Skill.slug`, which is also the
  // public filter identity. It replaced `labelEn` in that role: matching on the English label
  // meant that renaming a skill looked like a NEW skill, so the seed needed a `renamedFrom`
  // escape hatch to avoid orphaning the original's relations. Matching on a slug that never
  // changes removes the failure mode instead of compensating for it, so `renamedFrom` is gone
  // and a label edit is now just a label edit.
  readonly slug: string;
  readonly labelEn: string;
  readonly labelAr: string;
  // Omitted = visible. `false` keeps the record (and every project/experience link it carries)
  // while removing it from public listings — the approved taxonomy dropped it from display, and
  // deleting a linked skill would take its relations with it.
  readonly isPublic?: boolean;
}

// The approved public skills taxonomy — Docs `content/positioning-strategy.md` §5, owner decision
// 2026-08-05. Groups and order are the approved ones and are load-bearing: `SkillGroup`'s
// declaration order drives group sequence, `order` drives sequence inside a group.
//
// No levels, percentages, years or progress bars — the taxonomy names capabilities, it does not
// rate them. Brand colors per doc 03. Technology names keep their official Latin spelling in both
// locales; delivery practices carry genuine Arabic labels.
//
// Laravel is last inside Backend Engineering by decision: real, evidenced, supporting — never a
// primary positioning technology.
//
// The last three entries are HIDDEN, not deleted (`isPublic: false`). They left the public
// taxonomy but remain in the registry because project and experience relations resolve through
// them; `Web Performance`/`SEO`/`Vue.js` are renamed in place for the same reason.
export const SKILLS: readonly SkillSeed[] = [
  // ===== Languages =====
  {
    group: SkillGroup.LANGUAGE,
    order: 0,
    brandColor: '#3178C6',
    slug: 'typescript',
    labelEn: 'TypeScript',
    labelAr: 'TypeScript',
  },
  {
    group: SkillGroup.LANGUAGE,
    order: 1,
    brandColor: '#F7DF1E',
    slug: 'javascript',
    labelEn: 'JavaScript',
    labelAr: 'JavaScript',
  },
  {
    group: SkillGroup.LANGUAGE,
    order: 2,
    brandColor: '#777BB4',
    slug: 'php',
    labelEn: 'PHP',
    labelAr: 'PHP',
  },

  // ===== Frontend Engineering =====
  {
    group: SkillGroup.FRONTEND,
    order: 0,
    brandColor: '#42B883',
    slug: 'vue',
    labelEn: 'Vue',
    labelAr: 'Vue',
  },
  {
    group: SkillGroup.FRONTEND,
    order: 1,
    brandColor: '#00DC82',
    slug: 'nuxt',
    labelEn: 'Nuxt',
    labelAr: 'Nuxt',
  },
  {
    group: SkillGroup.FRONTEND,
    order: 2,
    brandColor: '#FFD859',
    slug: 'pinia',
    labelEn: 'Pinia',
    labelAr: 'Pinia',
  },
  {
    group: SkillGroup.FRONTEND,
    order: 3,
    brandColor: '#06B6D4',
    slug: 'tailwind-css',
    labelEn: 'Tailwind CSS',
    labelAr: 'Tailwind CSS',
  },

  // ===== Backend Engineering =====
  {
    group: SkillGroup.BACKEND,
    order: 0,
    brandColor: '#5FA04E',
    slug: 'nodejs',
    labelEn: 'Node.js',
    labelAr: 'Node.js',
  },
  {
    group: SkillGroup.BACKEND,
    order: 1,
    brandColor: '#E0234E',
    slug: 'nestjs',
    labelEn: 'NestJS',
    labelAr: 'NestJS',
  },
  {
    group: SkillGroup.BACKEND,
    order: 2,
    brandColor: '#2D3748',
    slug: 'prisma',
    labelEn: 'Prisma',
    labelAr: 'Prisma',
  },
  {
    group: SkillGroup.BACKEND,
    order: 3,
    brandColor: '#4945FF',
    slug: 'strapi',
    labelEn: 'Strapi',
    labelAr: 'Strapi',
  },
  {
    group: SkillGroup.BACKEND,
    order: 4,
    brandColor: '#FF2D20',
    slug: 'laravel',
    labelEn: 'Laravel',
    labelAr: 'Laravel',
  },

  // ===== Delivery & Quality =====
  {
    group: SkillGroup.DELIVERY,
    order: 0,
    brandColor: null,
    slug: 'requirements-analysis',
    labelEn: 'Requirements Analysis',
    labelAr: 'تحليل المتطلبات',
  },
  {
    group: SkillGroup.DELIVERY,
    order: 1,
    brandColor: null,
    slug: 'feature-ownership',
    labelEn: 'Feature Ownership',
    labelAr: 'امتلاك الميزة من البداية إلى النهاية',
  },
  {
    group: SkillGroup.DELIVERY,
    order: 2,
    brandColor: null,
    slug: 'testing',
    labelEn: 'Testing',
    labelAr: 'الاختبار',
  },
  {
    group: SkillGroup.DELIVERY,
    order: 3,
    brandColor: null,
    slug: 'performance',
    labelEn: 'Performance',
    labelAr: 'الأداء',
  },
  {
    group: SkillGroup.DELIVERY,
    order: 4,
    brandColor: null,
    slug: 'technical-seo',
    labelEn: 'Technical SEO',
    labelAr: 'تحسين محركات البحث التقني',
  },
  {
    group: SkillGroup.DELIVERY,
    order: 5,
    brandColor: null,
    slug: 'deployment',
    labelEn: 'Deployment',
    labelAr: 'النشر',
  },

  // ===== Retained but hidden =====
  // Off the public taxonomy, kept in the registry so existing and future project/experience
  // relations survive. High `order` values keep them out of the way of the curated sequence.
  {
    group: SkillGroup.FRONTEND,
    order: 90,
    brandColor: '#646CFF',
    slug: 'vite',
    labelEn: 'Vite',
    labelAr: 'Vite',
    isPublic: false,
  },
  {
    group: SkillGroup.DELIVERY,
    order: 90,
    brandColor: '#F05032',
    slug: 'git',
    labelEn: 'Git',
    labelAr: 'Git',
    isPublic: false,
  },
  {
    group: SkillGroup.DELIVERY,
    order: 91,
    brandColor: null,
    slug: 'accessibility',
    labelEn: 'Accessibility (a11y)',
    labelAr: 'إتاحة الوصول (a11y)',
    isPublic: false,
  },
];
