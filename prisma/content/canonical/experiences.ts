// Canonical Experiences (doc 09 §6.1). Natural key: the ENGLISH `(company, role)` pair —
// see `naturalKey()` in `prisma/sync/keys.ts` for why that pair and how ambiguity is refused.
// Pure data — no database calls.
import { EmploymentType } from '@prisma/client';

export interface ExperienceTranslationContent {
  readonly role: string;
  readonly company: string;
  readonly location: string;
  readonly impact: string; // Markdown bullet list
}

export interface ExperienceSeed {
  readonly startDate: Date;
  readonly endDate: Date | null;
  readonly isCurrent: boolean;
  readonly employmentType: EmploymentType;
  readonly order: number;
  readonly en: ExperienceTranslationContent;
  readonly ar: ExperienceTranslationContent;
  // Skill.slug of seeded skills — resolved to Skill ids at seed time (D09-17). Technologies come
  // from the Skill registry; no free-text labels are stored on the experience.
  readonly techKeys: readonly string[];
}

// Real employers from owner-profile §3 (HR-8). Impact bullets are grounded in the profile and carry NO
// invented metrics — the owner explicitly dislikes fake numbers (owner-profile §5, D02-2). The
// Findropica part-time→regular transition (~early 2026) is intentionally undated (the exact date is not
// recorded and must not be invented). Company locations are not in the profile; "Egypt"/"مصر" reflects
// the owner's country as a safe placeholder. Order is reverse-chronological by start date after the
// current role; the home summary re-sorts current-first client-side.
export const EXPERIENCES: readonly ExperienceSeed[] = [
  {
    startDate: new Date('2025-01-01T00:00:00.000Z'),
    endDate: null,
    isCurrent: true,
    employmentType: EmploymentType.FULL_TIME,
    order: 0,
    en: {
      role: 'Frontend Developer',
      company: 'Findropica',
      location: 'Egypt',
      impact:
        '- Build new Vue.js features inside Zidni, a large e-learning SaaS codebase, and modernize its dashboard\n- Built SAMT from scratch — a Nuxt institution website, a NestJS backend, and the admin/CMS — owning the frontend architecture and API integration (the UI/UX was designed in Figma by a designer)\n- Own component design, reusable UI patterns, and the Figma-to-production workflow; joined part-time and transitioned to a full-time role',
    },
    techKeys: ['vue', 'nuxt', 'nestjs', 'typescript'],
    ar: {
      role: 'مطوّر واجهات أمامية',
      company: 'Findropica',
      location: 'مصر',
      impact:
        '- أبني ميزات جديدة بلغة Vue.js داخل Zidni، وهو نظام SaaS تعليمي كبير، وأحدّث لوحة تحكّمه\n- بنيت SAMT من الصفر — موقع مؤسسة بـ Nuxt وخادمًا بـ NestJS ولوحة تحكّم/نظام إدارة محتوى — متوليًا معمارية الواجهة الأمامية وتكامل الواجهة البرمجية (صُمّمت تجربة المستخدم في Figma بواسطة مصمّم)\n- أتولّى تصميم المكوّنات وأنماط الواجهة القابلة لإعادة الاستخدام وسير العمل من Figma إلى الإنتاج؛ التحقت بدوام جزئي ثم انتقلت إلى دوام كامل',
    },
  },
  {
    startDate: new Date('2026-03-01T00:00:00.000Z'),
    endDate: new Date('2026-07-31T00:00:00.000Z'),
    isCurrent: false,
    employmentType: EmploymentType.CONTRACT,
    order: 1,
    en: {
      role: 'Full Stack Developer',
      company: 'WaveX',
      location: 'Egypt',
      impact:
        '- Built a multi-portal logistics platform — administrators, merchants, intercity operators, drivers, and last-mile partners — with Vue and Inertia.js on a Laravel backend\n- Translated requirements into tasks directly with the client and owned the architecture, code review, and validation\n- Practiced disciplined, AI-assisted engineering with full ownership of the delivery',
    },
    techKeys: ['vue', 'tailwind-css'],
    ar: {
      role: 'مطوّر متكامل',
      company: 'WaveX',
      location: 'مصر',
      impact:
        '- بنيت منصّة لوجستية متعدّدة البوّابات — المديرين والتجّار ومشغّلي النقل بين المدن والسائقين وشركاء التوصيل الأخير — باستخدام Vue و Inertia.js على خلفية Laravel\n- ترجمت المتطلّبات إلى مهام مباشرةً مع العميل، وتوليت المعمارية ومراجعة الشيفرة والتحقّق\n- مارست هندسة منضبطة بمساعدة الذكاء الاصطناعي مع ملكية كاملة للتسليم',
    },
  },
  {
    startDate: new Date('2023-11-01T00:00:00.000Z'),
    endDate: new Date('2026-02-28T00:00:00.000Z'),
    isCurrent: false,
    employmentType: EmploymentType.FULL_TIME,
    order: 2,
    en: {
      role: 'Frontend Developer',
      company: 'WeblyTech',
      location: 'Egypt',
      impact:
        '- Led Nuxt implementations across products for international clients\n- Built the customer storefront, vendor dashboard, and admin dashboard for Lure Stores, a multi-vendor e-commerce platform\n- Led the frontend for Nexa (event booking) and built core functionality for Vora; focused on SEO, SSR, i18n, and performance',
    },
    techKeys: ['nuxt', 'vue', 'technical-seo', 'performance'],
    ar: {
      role: 'مطوّر واجهات أمامية',
      company: 'WeblyTech',
      location: 'مصر',
      impact:
        '- قُدت تنفيذات Nuxt عبر منتجات لعملاء دوليين\n- بنيت واجهة المتجر ولوحة تحكّم البائعين ولوحة تحكّم الإدارة لمتجر Lure Stores متعدّد البائعين للتجارة الإلكترونية\n- قُدت الواجهة الأمامية لـ Nexa (حجز الفعاليات) وبنيت الوظائف الأساسية لـ Vora؛ مع تركيز على تحسين محركات البحث والتصيير من الخادم والتعريب والأداء',
    },
  },
];
