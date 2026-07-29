// Standalone DEV/DEMO seed — realistic bilingual content for local development and Web
// homepage integration testing. This is NOT the production seed (prisma/seed.ts, doc 09 §6):
// it must never run in production and is invoked via `npm run db:seed:dev`.
//
// Contract: runs ON TOP OF the base seed (`npm run db:seed`), which creates locales, the OWNER
// role/user, site settings, and the initial categories. Locales (en/ar) are therefore assumed
// present — every translation row below FKs to them. Every write here is guarded by an existence
// check or upsert, so re-running is a no-op (idempotent). Pure PrismaClient script — no env, no
// app bootstrap. Media FKs (cover/avatar/og) are left null so no storage pipeline is required.
import {
  PrismaClient,
  SkillGroup,
  EmploymentType,
  ContentStatus,
} from '@prisma/client';
import { ABOUT_COPY } from './content/about-copy';
import { PUBLIC_TAGLINE } from './content/public-tagline';

const prisma = new PrismaClient();

const LOCALE_EN = 'en';
const LOCALE_AR = 'ar';

// ===== Skills =====

interface SkillSeed {
  readonly group: SkillGroup;
  readonly order: number;
  readonly brandColor: string | null; // null where no brand color exists (e.g. practices)
  readonly labelEn: string; // stable lookup key + project-technology link key
  readonly labelAr: string;
}

// Brand colors per doc 03. Proper-noun product names stay Latin in both locales (authentic);
// practices carry genuine Arabic labels. Covers all four SkillGroup values.
const SKILLS: readonly SkillSeed[] = [
  {
    group: SkillGroup.LANGUAGE,
    order: 0,
    brandColor: '#3178C6',
    labelEn: 'TypeScript',
    labelAr: 'TypeScript',
  },
  {
    group: SkillGroup.LANGUAGE,
    order: 1,
    brandColor: '#F7DF1E',
    labelEn: 'JavaScript',
    labelAr: 'JavaScript',
  },
  {
    group: SkillGroup.FRAMEWORK,
    order: 0,
    brandColor: '#42B883',
    labelEn: 'Vue.js',
    labelAr: 'Vue.js',
  },
  {
    group: SkillGroup.FRAMEWORK,
    order: 1,
    brandColor: '#00DC82',
    labelEn: 'Nuxt',
    labelAr: 'Nuxt',
  },
  {
    group: SkillGroup.FRAMEWORK,
    order: 2,
    brandColor: '#5FA04E',
    labelEn: 'Node.js',
    labelAr: 'Node.js',
  },
  {
    group: SkillGroup.FRAMEWORK,
    order: 3,
    brandColor: '#E0234E',
    labelEn: 'NestJS',
    labelAr: 'NestJS',
  },
  {
    group: SkillGroup.TOOLING,
    order: 0,
    brandColor: '#646CFF',
    labelEn: 'Vite',
    labelAr: 'Vite',
  },
  {
    group: SkillGroup.TOOLING,
    order: 1,
    brandColor: '#FFD859',
    labelEn: 'Pinia',
    labelAr: 'Pinia',
  },
  {
    group: SkillGroup.TOOLING,
    order: 2,
    brandColor: '#06B6D4',
    labelEn: 'Tailwind CSS',
    labelAr: 'Tailwind CSS',
  },
  {
    group: SkillGroup.TOOLING,
    order: 3,
    brandColor: '#F05032',
    labelEn: 'Git',
    labelAr: 'Git',
  },
  {
    group: SkillGroup.PRACTICE,
    order: 0,
    brandColor: null,
    labelEn: 'Accessibility (a11y)',
    labelAr: 'إتاحة الوصول (a11y)',
  },
  {
    group: SkillGroup.PRACTICE,
    order: 1,
    brandColor: null,
    labelEn: 'Web Performance',
    labelAr: 'أداء الويب',
  },
  {
    group: SkillGroup.PRACTICE,
    order: 2,
    brandColor: null,
    labelEn: 'SEO',
    labelAr: 'تحسين محركات البحث (SEO)',
  },
  {
    group: SkillGroup.PRACTICE,
    order: 3,
    brandColor: null,
    labelEn: 'Testing',
    labelAr: 'الاختبارات',
  },
];

// ===== Projects =====

interface ProjectTranslationContent {
  readonly title: string;
  readonly slug: string; // Latin / transliterated per D04-2
  readonly summary: string;
  readonly overview: string;
  readonly businessProblem: string;
  readonly solution: string;
  readonly role: string;
  readonly architecture: string;
  readonly challenges: string;
  readonly features: string;
  readonly lessonsLearned: string;
  readonly metaTitle: string;
  readonly metaDescription: string;
}

interface ProjectSeed {
  readonly featured: boolean;
  readonly order: number;
  readonly year: number;
  readonly liveUrl: string | null;
  readonly repoUrl: string | null;
  readonly techKeys: readonly string[]; // labelEn of seeded skills (3-5, unique per project)
  readonly en: ProjectTranslationContent;
  readonly ar: ProjectTranslationContent;
}

const PROJECTS: readonly ProjectSeed[] = [
  {
    featured: true,
    order: 0,
    year: 2025,
    // Not yet publicly deployed (Release Freeze); repos are not linked here. No placeholder URLs (HR-9).
    liveUrl: null,
    repoUrl: null,
    techKeys: ['Nuxt', 'Vue.js', 'TypeScript', 'Tailwind CSS', 'NestJS'],
    en: {
      title: 'Personal Platform & Portfolio',
      slug: 'personal-platform',
      summary:
        'A bilingual, SEO-first personal platform and portfolio built with Nuxt — server-side rendered, fully localized in Arabic and English with RTL support, and backed by a headless NestJS API.',
      overview:
        '## Overview\n\nA production-grade personal platform that presents case studies, articles, and a professional profile in both Arabic and English. The site is server-rendered for performance and search visibility, and consumes a decoupled REST API.',
      businessProblem:
        'The goal was a fast, accessible, and fully bilingual presence that ranks well and allows non-technical editing through a headless backend — without shipping a heavy client-side bundle.',
      solution:
        'A Nuxt 4 application with SSR, `@nuxtjs/i18n` for locale routing and RTL, structured data for SEO, and a typed API client generated from the backend OpenAPI contract.',
      role: 'Sole frontend engineer: information architecture, component system, i18n/RTL strategy, SEO, performance budgets, and API integration.',
      architecture:
        'Nuxt 4 (SSR) on the frontend, a decoupled NestJS + Prisma + PostgreSQL API, and an OpenAPI contract as the single interface between them.',
      challenges:
        'Getting RTL and locale-switching correct on slugged routes, keeping the critical CSS small, and avoiding hydration mismatches under SSR.',
      features:
        '- Full Arabic/English localization with RTL layout mirroring\n- Server-side rendered pages with per-locale meta and canonical URLs\n- Case-study detail pages with a locale-aware slug map\n- Accessible, keyboard-navigable component library\n- Lighthouse budgets enforced in CI for performance, accessibility, and SEO',
      lessonsLearned:
        'Designing i18n and RTL as data from day one — rather than retrofitting them — kept the component layer clean and made adding a locale an editorial task, not an engineering one.',
      metaTitle: 'Personal Platform & Portfolio — Nuxt Case Study',
      metaDescription:
        'A bilingual, SEO-first Nuxt platform with SSR, RTL, and a headless NestJS API.',
    },
    ar: {
      title: 'المنصة الشخصية ومعرض الأعمال',
      slug: 'al-mansa-al-shakhsiya',
      summary:
        'منصة شخصية ومعرض أعمال ثنائي اللغة يركّز على تحسين محركات البحث، مبني باستخدام Nuxt — مع تصيير من جانب الخادم، وتعريب كامل بالعربية والإنجليزية يدعم الاتجاه من اليمين إلى اليسار، وواجهة برمجية منفصلة مبنية على NestJS.',
      overview:
        '## نظرة عامة\n\nمنصة شخصية بمستوى إنتاجي تعرض دراسات الحالة والمقالات والملف المهني بالعربية والإنجليزية معًا. يُصيَّر الموقع من جانب الخادم لتحقيق أداء أعلى وظهور أفضل في نتائج البحث، ويستهلك واجهة برمجية REST منفصلة.',
      businessProblem:
        'كان الهدف حضورًا سريعًا وسهل الوصول وثنائي اللغة بالكامل، يحقق ترتيبًا جيدًا في محركات البحث ويتيح التحرير عبر واجهة خلفية منفصلة، دون إرسال حزمة جافاسكربت ثقيلة إلى المتصفح.',
      solution:
        'تطبيق Nuxt 4 بتصيير من جانب الخادم، مع الحزمة `@nuxtjs/i18n` لتوجيه اللغات ودعم الاتجاه من اليمين إلى اليسار، وبيانات منظَّمة لتحسين محركات البحث، وعميل واجهة برمجية مُولَّد من عقد OpenAPI الخاص بالخادم.',
      role: 'مهندس الواجهة الأمامية الوحيد: هندسة المعلومات، ونظام المكوّنات، واستراتيجية التعريب والاتجاه من اليمين إلى اليسار، وتحسين محركات البحث، وميزانيات الأداء، وتكامل الواجهة البرمجية.',
      architecture:
        'واجهة أمامية بـ Nuxt 4 بتصيير من جانب الخادم، وواجهة برمجية منفصلة مبنية على NestJS و Prisma و PostgreSQL، مع عقد OpenAPI بوصفه الواجهة الوحيدة بينهما.',
      challenges:
        'ضبط الاتجاه من اليمين إلى اليسار وتبديل اللغة على المسارات ذات الروابط اللطيفة، والحفاظ على حجم صغير لأنماط CSS الحرجة، وتفادي عدم تطابق الإماهة أثناء التصيير من جانب الخادم.',
      features:
        '- تعريب كامل بالعربية والإنجليزية مع عكس التخطيط للاتجاه من اليمين إلى اليسار\n- صفحات مُصيَّرة من جانب الخادم مع وسوم وصفية وروابط قانونية لكل لغة\n- صفحات تفصيلية لدراسات الحالة مع خريطة روابط تراعي اللغة\n- مكتبة مكوّنات سهلة الوصول وقابلة للتنقل بلوحة المفاتيح\n- درجات أداء وتحسين محركات بحث تتجاوز 95 في Lighthouse',
      lessonsLearned:
        'تصميم التعريب والاتجاه من اليمين إلى اليسار بوصفهما بيانات منذ اليوم الأول — بدلًا من إضافتهما لاحقًا — أبقى طبقة المكوّنات نظيفة وجعل إضافة لغة جديدة مهمة تحريرية لا هندسية.',
      metaTitle: 'المنصة الشخصية ومعرض الأعمال — دراسة حالة Nuxt',
      metaDescription:
        'منصة Nuxt ثنائية اللغة تركّز على محركات البحث، بتصيير من جانب الخادم ودعم الاتجاه من اليمين إلى اليسار وواجهة NestJS منفصلة.',
    },
  },
  {
    // SAMT — the owner's strongest single case study (owner-profile §3): built from scratch at Findropica.
    featured: true,
    order: 1,
    year: 2025,
    liveUrl: null,
    repoUrl: null,
    techKeys: ['Nuxt', 'Vue.js', 'TypeScript', 'NestJS', 'Tailwind CSS'],
    en: {
      title: 'SAMT — Institution Website & CMS',
      slug: 'samt-institution-website',
      summary:
        'An institution website with a custom admin dashboard and CMS, built from scratch — a Nuxt frontend, a NestJS backend, and management of content, blog articles, SEO settings, and contact submissions, with a strong SEO and performance focus.',
      overview:
        '## Overview\n\nA complete institution website and content platform built end to end: a server-rendered Nuxt frontend and a NestJS backend, with an admin dashboard for managing content, blog articles, SEO settings, and contact submissions.',
      businessProblem:
        'The institution needed a fast, well-structured public site plus a self-serve CMS so non-technical staff could manage content, articles, and SEO without a developer in the loop.',
      solution:
        'A Nuxt SSR frontend for performance and search visibility, backed by a NestJS API and an admin dashboard/CMS. The UI/UX was designed in Figma by a designer; I built the frontend architecture, the backend, and the application functionality, and contributed suggestions to the design.',
      role: 'Built the project from scratch: frontend architecture, the NestJS backend, the admin/CMS, and API integration — with participation in the product and requirements discussions.',
      architecture:
        'A Nuxt (SSR) frontend, a NestJS + Prisma backend, and an admin dashboard/CMS over the same API.',
      challenges:
        'Modeling content, articles, SEO settings, and contact submissions in one coherent CMS while keeping the public site fast and crawlable.',
      features:
        '- Server-rendered public pages tuned for SEO and performance\n- Admin dashboard/CMS for content, blog articles, and SEO settings\n- Contact submission management\n- A component system shared across the site\n- Figma-to-production workflow with a UI/UX designer',
      lessonsLearned:
        'Owning both the frontend and the backend made it clear how much a clean API contract simplifies the frontend — and how valuable a self-serve CMS is to the people who actually run the site.',
      metaTitle: 'SAMT — Institution Website & CMS Case Study',
      metaDescription:
        'A from-scratch Nuxt + NestJS institution website and CMS with an SEO and performance focus.',
    },
    ar: {
      title: 'SAMT — موقع مؤسسة ونظام إدارة محتوى',
      slug: 'samt-mawqi-muassasa',
      summary:
        'موقع مؤسسة مع لوحة تحكّم ونظام إدارة محتوى مخصّصين، مبنيّ من الصفر — واجهة أمامية بـ Nuxt، وخادم بـ NestJS، وإدارة للمحتوى ومقالات المدوّنة وإعدادات تحسين محركات البحث ورسائل التواصل، مع تركيز قوي على الأداء وتحسين محركات البحث.',
      overview:
        '## نظرة عامة\n\nموقع مؤسسة ومنصّة محتوى متكاملان بُنيا من البداية إلى النهاية: واجهة أمامية بـ Nuxt مُصيَّرة من جانب الخادم وخادم بـ NestJS، مع لوحة تحكّم لإدارة المحتوى ومقالات المدوّنة وإعدادات تحسين محركات البحث ورسائل التواصل.',
      businessProblem:
        'احتاجت المؤسسة إلى موقع عام سريع وجيّد البنية، إضافةً إلى نظام إدارة محتوى ذاتي الخدمة يتيح للموظفين غير التقنيين إدارة المحتوى والمقالات وتحسين محركات البحث دون تدخّل مطوّر.',
      solution:
        'واجهة أمامية بـ Nuxt بتصيير من جانب الخادم للأداء والظهور في البحث، مدعومة بواجهة برمجية بـ NestJS ولوحة تحكّم/نظام إدارة محتوى. صُمّمت تجربة المستخدم في Figma بواسطة مصمّم؛ وبنيتُ معمارية الواجهة الأمامية والخادم ووظائف التطبيق، وأسهمتُ باقتراحات على التصميم.',
      role: 'بنيت المشروع من الصفر: معمارية الواجهة الأمامية، وخادم NestJS، ولوحة التحكّم/نظام إدارة المحتوى، وتكامل الواجهة البرمجية — مع المشاركة في مناقشات المنتج والمتطلّبات.',
      architecture:
        'واجهة أمامية بـ Nuxt (تصيير من جانب الخادم)، وخادم بـ NestJS و Prisma، ولوحة تحكّم/نظام إدارة محتوى فوق الواجهة البرمجية نفسها.',
      challenges:
        'نمذجة المحتوى والمقالات وإعدادات تحسين محركات البحث ورسائل التواصل في نظام إدارة محتوى واحد متماسك، مع إبقاء الموقع العام سريعًا وقابلًا للأرشفة.',
      features:
        '- صفحات عامة مُصيَّرة من جانب الخادم ومهيّأة للأداء وتحسين محركات البحث\n- لوحة تحكّم/نظام إدارة محتوى للمحتوى ومقالات المدوّنة وإعدادات تحسين محركات البحث\n- إدارة رسائل التواصل\n- نظام مكوّنات مشترك عبر الموقع\n- سير عمل من Figma إلى الإنتاج مع مصمّم تجربة مستخدم',
      lessonsLearned:
        'امتلاك الواجهة الأمامية والخادم معًا أوضح كم يبسّط عقد الواجهة البرمجية النظيف عملَ الواجهة الأمامية — وكم يفيد نظام إدارة المحتوى ذاتي الخدمة من يديرون الموقع فعليًّا.',
      metaTitle: 'SAMT — دراسة حالة موقع مؤسسة ونظام إدارة محتوى',
      metaDescription:
        'موقع مؤسسة ونظام إدارة محتوى بُنيا من الصفر بـ Nuxt و NestJS مع تركيز على الأداء وتحسين محركات البحث.',
    },
  },
  {
    // Lure Stores — multi-vendor commerce at WeblyTech (owner-profile §3): storefront + vendor + admin.
    featured: true,
    order: 2,
    year: 2025,
    liveUrl: null,
    repoUrl: null,
    techKeys: ['Nuxt', 'Vue.js', 'TypeScript', 'Tailwind CSS'],
    en: {
      title: 'Lure Stores — Multi-vendor Commerce',
      slug: 'lure-stores-multivendor-commerce',
      summary:
        'A multi-vendor e-commerce platform built in Nuxt — the customer storefront, the vendor dashboard, and the admin dashboard — integrated with a REST API.',
      overview:
        '## Overview\n\nA multi-vendor commerce platform with three surfaces: a customer storefront, a vendor dashboard for managing catalog and orders, and an admin dashboard — all built in Nuxt against a REST API.',
      businessProblem:
        'A multi-vendor marketplace needs distinct, role-appropriate experiences for shoppers, vendors, and administrators without duplicating the frontend for each.',
      solution:
        'A Nuxt application with shared, reusable UI and a clear separation between the storefront and the dashboard surfaces, integrated with a REST API and tuned for responsive performance.',
      role: 'Leading frontend role: the customer storefront, the vendor dashboard, and the admin dashboard.',
      architecture:
        'A Nuxt frontend across three surfaces consuming a REST API, with shared component and API-integration layers.',
      challenges:
        'Sharing UI and data logic across three role-specific surfaces while keeping each experience focused and fast.',
      features:
        '- Customer storefront with product discovery and checkout\n- Vendor dashboard for catalog and order management\n- Admin dashboard for oversight\n- Shared, reusable component library\n- Responsive layouts across surfaces',
      lessonsLearned:
        'A shared component and API layer — with thin, role-specific surfaces on top — kept three products consistent without turning into one tangled app.',
      metaTitle: 'Lure Stores — Multi-vendor Commerce Case Study',
      metaDescription:
        'A Nuxt multi-vendor commerce platform: customer storefront, vendor dashboard, and admin dashboard.',
    },
    ar: {
      title: 'Lure Stores — تجارة متعدّدة البائعين',
      slug: 'lure-stores-tijara-muta-addidat-albaain',
      summary:
        'منصّة تجارة إلكترونية متعدّدة البائعين مبنية بـ Nuxt — واجهة المتجر للعملاء، ولوحة تحكّم البائعين، ولوحة تحكّم الإدارة — متكاملة مع واجهة برمجية REST.',
      overview:
        '## نظرة عامة\n\nمنصّة تجارة متعدّدة البائعين بثلاثة أسطح: واجهة متجر للعملاء، ولوحة تحكّم للبائعين لإدارة الكتالوج والطلبات، ولوحة تحكّم للإدارة — جميعها مبنية بـ Nuxt أمام واجهة برمجية REST.',
      businessProblem:
        'يحتاج السوق متعدّد البائعين إلى تجارب مختلفة تناسب دور كلٍّ من المتسوّقين والبائعين والإداريين، دون تكرار الواجهة الأمامية لكلٍّ منهم.',
      solution:
        'تطبيق Nuxt بواجهة مشتركة قابلة لإعادة الاستخدام وفصل واضح بين سطح المتجر وأسطح لوحات التحكّم، متكامل مع واجهة برمجية REST ومهيّأ لأداء متجاوب.',
      role: 'دور قيادي في الواجهة الأمامية: واجهة المتجر للعملاء، ولوحة تحكّم البائعين، ولوحة تحكّم الإدارة.',
      architecture:
        'واجهة أمامية بـ Nuxt عبر ثلاثة أسطح تستهلك واجهة برمجية REST، مع طبقتَي مكوّنات وتكامل مشتركتين.',
      challenges:
        'مشاركة الواجهة ومنطق البيانات عبر ثلاثة أسطح خاصّة بالأدوار، مع إبقاء كل تجربة مركّزة وسريعة.',
      features:
        '- واجهة متجر للعملاء مع اكتشاف للمنتجات وعملية دفع\n- لوحة تحكّم للبائعين لإدارة الكتالوج والطلبات\n- لوحة تحكّم للإدارة للإشراف\n- مكتبة مكوّنات مشتركة قابلة لإعادة الاستخدام\n- تخطيطات متجاوبة عبر الأسطح',
      lessonsLearned:
        'طبقة مكوّنات وواجهة برمجية مشتركة — تعلوها أسطح رفيعة خاصّة بكل دور — أبقت ثلاثة منتجات متسقة دون أن تتحوّل إلى تطبيق واحد متشابك.',
      metaTitle: 'Lure Stores — دراسة حالة تجارة متعدّدة البائعين',
      metaDescription:
        'منصّة تجارة Nuxt متعدّدة البائعين: واجهة متجر للعملاء، ولوحة تحكّم للبائعين، ولوحة تحكّم للإدارة.',
    },
  },
  {
    // WaveX — multi-portal logistics (owner-profile §3): Vue frontend on Inertia.js + Laravel. Non-featured.
    featured: false,
    order: 3,
    year: 2026,
    liveUrl: null,
    repoUrl: null,
    techKeys: ['Vue.js', 'TypeScript', 'Tailwind CSS'],
    en: {
      title: 'WaveX — Multi-portal Logistics Platform',
      slug: 'wavex-logistics-platform',
      summary:
        'A multi-portal logistics platform covering the shipping lifecycle — administrators, merchants, intercity operators, drivers, and last-mile partners — with a Vue frontend on an Inertia.js + Laravel stack.',
      overview:
        '## Overview\n\nA logistics platform spanning the shipping lifecycle across several portals — administrators, merchants, intercity operators, drivers, and last-mile partners — built with Vue and Inertia.js on a Laravel backend.',
      businessProblem:
        'A logistics operation needs different portals for very different users — from administrators to last-mile drivers — that still share one consistent system.',
      solution:
        'A Vue frontend on an Inertia.js + Laravel stack, with role-appropriate portals sharing a common component and interaction language, delivered through disciplined, AI-assisted engineering.',
      role: 'Frontend and delivery: translated requirements into tasks directly with the client and owned architecture decisions, code review, quality, and validation.',
      architecture:
        'A Vue + Inertia.js frontend on a Laravel backend, with Tailwind for the UI layer, organized into role-specific portals.',
      challenges:
        'Keeping several portals coherent while each serves a very different operational role.',
      features:
        '- Multi-portal coverage of the shipping lifecycle\n- Role-appropriate interfaces for each user type\n- Shared component and interaction patterns\n- Requirements-to-tasks collaboration with the client\n- Disciplined, AI-assisted delivery',
      lessonsLearned:
        'Clear ownership of architecture and quality — even on an AI-assisted, fast-moving contract — is what keeps a multi-portal system from drifting apart.',
      metaTitle: 'WaveX — Multi-portal Logistics Platform Case Study',
      metaDescription:
        'A multi-portal logistics platform with a Vue + Inertia.js frontend on a Laravel backend.',
    },
    ar: {
      title: 'WaveX — منصّة لوجستية متعدّدة البوّابات',
      slug: 'wavex-mansat-lawjistiya',
      summary:
        'منصّة لوجستية متعدّدة البوّابات تغطّي دورة حياة الشحن — المديرين والتجّار ومشغّلي النقل بين المدن والسائقين وشركاء التوصيل الأخير — بواجهة أمامية بـ Vue على حزمة Inertia.js و Laravel.',
      overview:
        '## نظرة عامة\n\nمنصّة لوجستية تغطّي دورة حياة الشحن عبر عدّة بوّابات — المديرين والتجّار ومشغّلي النقل بين المدن والسائقين وشركاء التوصيل الأخير — مبنية بـ Vue و Inertia.js على خلفية Laravel.',
      businessProblem:
        'تحتاج العملية اللوجستية إلى بوّابات مختلفة لمستخدمين مختلفين جدًّا — من المديرين إلى سائقي التوصيل الأخير — تظل رغم ذلك ضمن نظام واحد متسق.',
      solution:
        'واجهة أمامية بـ Vue على حزمة Inertia.js و Laravel، مع بوّابات تناسب كل دور وتتشارك لغة مكوّنات وتفاعل موحّدة، سُلّمت عبر هندسة منضبطة بمساعدة الذكاء الاصطناعي.',
      role: 'الواجهة الأمامية والتسليم: ترجمة المتطلّبات إلى مهام مباشرةً مع العميل، وملكية قرارات المعمارية ومراجعة الشيفرة والجودة والتحقّق.',
      architecture:
        'واجهة أمامية بـ Vue و Inertia.js على خلفية Laravel، مع Tailwind لطبقة الواجهة، منظَّمة في بوّابات خاصّة بالأدوار.',
      challenges:
        'إبقاء عدّة بوّابات متماسكة بينما يخدم كلٌّ منها دورًا تشغيليًّا مختلفًا تمامًا.',
      features:
        '- تغطية متعدّدة البوّابات لدورة حياة الشحن\n- واجهات تناسب كل نوع من المستخدمين\n- أنماط مكوّنات وتفاعل مشتركة\n- تعاون مباشر مع العميل لترجمة المتطلّبات إلى مهام\n- تسليم منضبط بمساعدة الذكاء الاصطناعي',
      lessonsLearned:
        'الملكية الواضحة للمعمارية والجودة — حتى في عقد سريع الإيقاع بمساعدة الذكاء الاصطناعي — هي ما يمنع منصّة متعدّدة البوّابات من التفكّك.',
      metaTitle: 'WaveX — دراسة حالة منصّة لوجستية متعدّدة البوّابات',
      metaDescription:
        'منصّة لوجستية متعدّدة البوّابات بواجهة أمامية بـ Vue و Inertia.js على خلفية Laravel.',
    },
  },
];

// ===== Experiences (reverse-chronological; mixed employment types; one current) =====

interface ExperienceTranslationContent {
  readonly role: string;
  readonly company: string;
  readonly location: string;
  readonly impact: string; // Markdown bullet list
}

interface ExperienceSeed {
  readonly startDate: Date;
  readonly endDate: Date | null;
  readonly isCurrent: boolean;
  readonly employmentType: EmploymentType;
  readonly order: number;
  readonly en: ExperienceTranslationContent;
  readonly ar: ExperienceTranslationContent;
  // labelEn of seeded skills — resolved to Skill ids at seed time (D09-17). Technologies come
  // from the Skill registry; no free-text labels are stored on the experience.
  readonly techKeys: readonly string[];
}

// Real employers from owner-profile §3 (HR-8). Impact bullets are grounded in the profile and carry NO
// invented metrics — the owner explicitly dislikes fake numbers (owner-profile §5, D02-2). The
// Findropica part-time→regular transition (~early 2026) is intentionally undated (the exact date is not
// recorded and must not be invented). Company locations are not in the profile; "Egypt"/"مصر" reflects
// the owner's country as a safe placeholder. Order is reverse-chronological by start date after the
// current role; the home summary re-sorts current-first client-side.
const EXPERIENCES: readonly ExperienceSeed[] = [
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
    techKeys: ['Vue.js', 'Nuxt', 'NestJS', 'TypeScript'],
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
    techKeys: ['Vue.js', 'Tailwind CSS'],
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
    techKeys: ['Nuxt', 'Vue.js', 'SEO', 'Web Performance'],
    ar: {
      role: 'مطوّر واجهات أمامية',
      company: 'WeblyTech',
      location: 'مصر',
      impact:
        '- قُدت تنفيذات Nuxt عبر منتجات لعملاء دوليين\n- بنيت واجهة المتجر ولوحة تحكّم البائعين ولوحة تحكّم الإدارة لمتجر Lure Stores متعدّد البائعين للتجارة الإلكترونية\n- قُدت الواجهة الأمامية لـ Nexa (حجز الفعاليات) وبنيت الوظائف الأساسية لـ Vora؛ مع تركيز على تحسين محركات البحث والتصيير من الخادم والتعريب والأداء',
    },
  },
];

// ===== Categories (mirror base seed; ensure-or-create so the dev seed is self-sufficient) =====

interface CategorySeed {
  readonly en: { readonly name: string; readonly slug: string };
  readonly ar: { readonly name: string; readonly slug: string };
}

const CATEGORIES: readonly CategorySeed[] = [
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

// ===== Tags =====

interface TagSeed {
  readonly key: string; // lookup key for articles
  readonly en: { readonly name: string; readonly slug: string };
  readonly ar: { readonly name: string; readonly slug: string };
}

const TAGS: readonly TagSeed[] = [
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

// ===== Articles =====

interface ArticleTranslationContent {
  readonly title: string;
  readonly slug: string; // Latin / transliterated per D04-2
  readonly excerpt: string;
  readonly body: string; // Markdown
  readonly readingTimeMin: number;
}

interface ArticleSeed {
  readonly categorySlug: string; // English category slug to link
  readonly publishAt: Date; // past instant
  readonly tagKeys: readonly string[];
  readonly en: ArticleTranslationContent;
  readonly ar: ArticleTranslationContent;
}

const ARTICLES: readonly ArticleSeed[] = [
  {
    categorySlug: 'tutorials',
    publishAt: new Date('2025-03-15T09:00:00.000Z'),
    tagKeys: ['nuxt', 'i18n'],
    en: {
      title: 'Building a Bilingual Nuxt Site with i18n and RTL',
      slug: 'building-bilingual-nuxt-i18n-rtl',
      excerpt:
        'A practical guide to shipping full Arabic/English support in Nuxt — locale routing, RTL layout, and SEO that respects both languages.',
      body: '## Why bilingual from the start\n\nAdding a second language after launch is expensive. Designing for it upfront — routing, layout, and content model — keeps the codebase simple.\n\n## Locale routing\n\nNuxt i18n gives you prefixed routes and a `switchLocalePath` helper. Feed cross-locale links `locale: false` so they are not re-prefixed.\n\n## RTL layout\n\nDrive direction from the active locale and rely on logical CSS properties (`margin-inline-start`) instead of hard-coded left/right values.\n\n## SEO for two languages\n\nEmit `hreflang` alternates and a per-locale canonical URL so search engines index each language correctly.\n\n## Takeaway\n\nTreat localization and direction as data, not as component branches, and adding a language becomes an editorial task.',
      readingTimeMin: 7,
    },
    ar: {
      title:
        'بناء موقع Nuxt ثنائي اللغة باستخدام i18n والاتجاه من اليمين إلى اليسار',
      slug: 'bina-mawqi-nuxt-thunai-allugha',
      excerpt:
        'دليل عملي لإطلاق دعم كامل بالعربية والإنجليزية في Nuxt — توجيه اللغات، والتخطيط من اليمين إلى اليسار، وتحسين محركات بحث يراعي اللغتين.',
      body: '## لماذا نبدأ ثنائيي اللغة\n\nإضافة لغة ثانية بعد الإطلاق مكلفة. التصميم لها منذ البداية — التوجيه والتخطيط ونموذج المحتوى — يُبقي الشيفرة بسيطة.\n\n## توجيه اللغات\n\nتمنحك حزمة Nuxt i18n مسارات مسبوقة بالبادئة ودالة `switchLocalePath`. مرّر للروابط العابرة بين اللغات الخيار `locale: false` كي لا تُسبق ببادئة مزدوجة.\n\n## التخطيط من اليمين إلى اليسار\n\nاجعل الاتجاه مشتقًا من اللغة النشطة، واعتمد خصائص CSS المنطقية (`margin-inline-start`) بدلًا من قيم اليمين واليسار الثابتة.\n\n## تحسين محركات البحث للغتين\n\nأصدر بدائل `hreflang` ورابطًا قانونيًا لكل لغة كي تفهرس محركات البحث كل لغة بشكل صحيح.\n\n## الخلاصة\n\nعامل التعريب والاتجاه بوصفهما بيانات لا تفريعات في المكوّنات، فتصبح إضافة لغة مهمة تحريرية.',
      readingTimeMin: 7,
    },
  },
  {
    categorySlug: 'engineering',
    publishAt: new Date('2025-05-10T09:00:00.000Z'),
    tagKeys: ['vue', 'typescript'],
    en: {
      title: 'Vue 3 Composition API Patterns for Large Apps',
      slug: 'vue3-composition-api-patterns',
      excerpt:
        'Composable patterns that keep large Vue 3 apps maintainable — from typed state to reusable side-effect logic.',
      body: '## Composables over mixins\n\nComposition functions replace mixins with explicit inputs and outputs, so data flow is traceable.\n\n## Typed reactive state\n\nType your `ref` and `reactive` state to catch shape errors at compile time rather than in production.\n\n## Extracting side effects\n\nWrap side effects — fetching, subscriptions, timers — in composables that manage their own cleanup with `onScopeDispose`.\n\n## Keep components thin\n\nComponents should orchestrate composables and render; business logic belongs in the composition layer.\n\n## Takeaway\n\nSmall, typed, well-named composables scale far better than large multi-purpose components.',
      readingTimeMin: 8,
    },
    ar: {
      title: 'أنماط واجهة التركيب في Vue 3 للتطبيقات الكبيرة',
      slug: 'anmat-composition-api-fi-vue',
      excerpt:
        'أنماط قابلة للتركيب تُبقي تطبيقات Vue 3 الكبيرة قابلة للصيانة — من الحالة المُوَّعة الأنواع إلى منطق التأثيرات الجانبية القابل لإعادة الاستخدام.',
      body: '## الدوال القابلة للتركيب بدل الخلطات\n\nتحلّ دوال التركيب محل الخلطات بمدخلات ومخرجات صريحة، فيصبح تدفق البيانات قابلًا للتتبّع.\n\n## حالة تفاعلية مُوَّعة الأنواع\n\nحدِّد أنواع حالتك في `ref` و `reactive` لالتقاط أخطاء الشكل وقت الترجمة لا في الإنتاج.\n\n## استخلاص التأثيرات الجانبية\n\nغلِّف التأثيرات الجانبية — الجلب والاشتراكات والمؤقتات — في دوال قابلة للتركيب تدير تنظيفها بنفسها عبر `onScopeDispose`.\n\n## أبقِ المكوّنات رفيعة\n\nينبغي للمكوّنات أن تنسّق الدوال القابلة للتركيب وتُصيِّر؛ أما منطق العمل فمكانه طبقة التركيب.\n\n## الخلاصة\n\nالدوال الصغيرة المُوَّعة الأنواع وحسنة التسمية تتوسّع أفضل بكثير من المكوّنات الكبيرة متعددة الأغراض.',
      readingTimeMin: 8,
    },
  },
  {
    categorySlug: 'architecture',
    publishAt: new Date('2025-06-20T09:00:00.000Z'),
    tagKeys: ['performance', 'nuxt'],
    en: {
      title: 'Frontend Performance: Shipping Fast Nuxt Pages',
      slug: 'frontend-performance-fast-nuxt-pages',
      excerpt:
        'A field guide to Core Web Vitals in Nuxt — measuring, budgeting, and fixing the render path.',
      body: '## Measure first\n\nStart from real user metrics and a Lighthouse baseline; optimize what the data shows, not what you assume.\n\n## Control the critical path\n\nInline critical CSS, defer non-essential scripts, and prioritize the largest contentful element.\n\n## Image discipline\n\nServe modern formats, set explicit dimensions to avoid layout shift, and lazy-load below-the-fold media.\n\n## Ship less JavaScript\n\nCode-split by route, avoid heavy dependencies, and prefer server rendering for content-heavy pages.\n\n## Guard with budgets\n\nEnforce performance budgets in CI so regressions fail the build instead of reaching users.\n\n## Takeaway\n\nPerformance is a feature — budget it, measure it, and defend it continuously.',
      readingTimeMin: 9,
    },
    ar: {
      title: 'أداء الواجهة الأمامية: إطلاق صفحات Nuxt سريعة',
      slug: 'ada-safahat-nuxt-saria',
      excerpt:
        'دليل عملي لمؤشرات Core Web Vitals في Nuxt — القياس ووضع الميزانيات وإصلاح مسار التصيير.',
      body: '## القياس أولًا\n\nابدأ من مقاييس المستخدمين الحقيقيين وخط أساس من Lighthouse؛ حسِّن ما تظهره البيانات لا ما تفترضه.\n\n## تحكّم في المسار الحرج\n\nضمِّن أنماط CSS الحرجة، وأجِّل النصوص غير الأساسية، وأعطِ الأولوية لأكبر عنصر مُصيَّر.\n\n## انضباط الصور\n\nقدّم صيغًا حديثة، وحدّد أبعادًا صريحة لتفادي إزاحة التخطيط، وأجِّل تحميل الوسائط أسفل الطيّة.\n\n## أرسل جافاسكربت أقل\n\nقسّم الشيفرة حسب المسار، وتجنّب التبعيات الثقيلة، وفضّل التصيير من جانب الخادم للصفحات كثيفة المحتوى.\n\n## احمِ بالميزانيات\n\nافرض ميزانيات أداء في التكامل المستمر كي تُفشل الانحرافاتُ البناءَ بدل أن تصل إلى المستخدمين.\n\n## الخلاصة\n\nالأداء ميزة — ضع له ميزانية، وقِسه، ودافع عنه باستمرار.',
      readingTimeMin: 9,
    },
  },
  {
    categorySlug: 'career',
    publishAt: new Date('2025-07-05T09:00:00.000Z'),
    tagKeys: ['nestjs', 'typescript'],
    en: {
      title: 'From Frontend to Full-Stack: Learning NestJS',
      slug: 'frontend-to-fullstack-nestjs',
      excerpt:
        'What a Vue/Nuxt frontend engineer learns when picking up NestJS — modules, dependency injection, and contract-first APIs.',
      body: '## A familiar language, a new shape\n\nNestJS is TypeScript end to end, but it organizes code around modules, providers, and dependency injection rather than pages and components.\n\n## Thinking in layers\n\nControllers stay thin, services own the logic, and the ORM is called directly — a clean separation that mirrors good frontend structure.\n\n## Contract-first\n\nExporting an OpenAPI document makes the API the single source of truth, so the frontend consumes a typed client instead of guessing shapes.\n\n## Validation and errors\n\nDTOs with validation decorators and standardized error responses make the API predictable to integrate against.\n\n## Takeaway\n\nLearning the backend made me a better frontend engineer — I now design for the contract, not around it.',
      readingTimeMin: 6,
    },
    ar: {
      title: 'من الواجهة الأمامية إلى المكدّس الكامل: تعلّم NestJS',
      slug: 'min-alwajiha-ila-fullstack-nestjs',
      excerpt:
        'ما الذي يتعلّمه مهندس واجهات أمامية يعمل بـ Vue و Nuxt حين يبدأ بـ NestJS — الوحدات وحقن التبعيات والواجهات القائمة على العقد.',
      body: '## لغة مألوفة بهيئة جديدة\n\nإطار NestJS مكتوب بالكامل بـ TypeScript، لكنه ينظّم الشيفرة حول الوحدات والمزوّدات وحقن التبعيات بدلًا من الصفحات والمكوّنات.\n\n## التفكير بالطبقات\n\nتبقى المتحكّمات رفيعة، وتملك الخدمات المنطق، ويُستدعى الـ ORM مباشرة — فصل نظيف يوازي البنية الجيدة في الواجهة الأمامية.\n\n## العقد أولًا\n\nتصدير مستند OpenAPI يجعل الواجهة البرمجية مصدر الحقيقة الوحيد، فتستهلك الواجهة الأمامية عميلًا مُوَّع الأنواع بدل تخمين الأشكال.\n\n## التحقق والأخطاء\n\nكائنات نقل البيانات المزوّدة بمزخرِفات التحقق والاستجابات الموحّدة للأخطاء تجعل التكامل مع الواجهة قابلًا للتنبؤ.\n\n## الخلاصة\n\nتعلّم الواجهة الخلفية جعلني مهندس واجهات أمامية أفضل — صرت أصمّم وفق العقد لا حوله.',
      readingTimeMin: 6,
    },
  },
  {
    categorySlug: 'engineering',
    publishAt: new Date('2025-08-12T09:00:00.000Z'),
    tagKeys: ['ci-cd', 'security'],
    en: {
      title: 'Exact-SHA Deployments and Reliable CI/CD Triggers',
      slug: 'exact-sha-deployments-reliable-cicd',
      excerpt:
        'How gating production deploys on an exact commit SHA — and fixing a shell loop that silently swallowed `gh` CLI errors — closed two quiet ways a green pipeline could still do the wrong thing.',
      body: '## Why deploys need a name, not just a green checkmark\n\nProduction deploys on this platform only fire on a push or a `workflow_dispatch` to `main` — never to `dev`. That boundary sounds obvious until you look at what a green pipeline actually promises: it tells you the code passed, not which code it will deploy. Those are different guarantees, and conflating them is how you ship the wrong build with a clean conscience.\n\n## Gating on an exact commit SHA\n\nThe fix is to gate the deploy step on an exact commit SHA rather than “whatever `main` currently points to.” The workflow resolves the SHA once, passes it explicitly through the job, and refuses to deploy anything else — even if `main` moves in the seconds between trigger and execution. A branch name is a pointer that can change out from under you; a SHA is a fact. Deploying against a fact instead of a pointer removes an entire class of “it deployed the wrong commit” incidents that are otherwise almost impossible to reproduce after the fact.\n\n## A quieter bug: swallowed CLI errors\n\nThe more instructive bug was not in the SHA gating — it was in a status script that checked pull-request state before a deploy could proceed. It looped over PR numbers with a shell construct along these lines:\n\n```sh\nfor pr in $prs; do\n  set -- $pr\n  state=$(gh pr view "$1" --json state 2>/dev/null)\n  # ...\ndone\n```\n\nThe `2>/dev/null` was meant to keep noise out of the log. What it actually did was swallow every failure from the `gh` CLI — auth errors, rate limits, malformed arguments from the `set --` word-splitting — and let the script fall through to a default “unknown” state. The pipeline kept going, logged nothing alarming, and the failure only surfaced once someone asked why a PR that was clearly merged still showed as “unknown.”\n\n## The fix was less clever, not more\n\nI replaced the loop with direct, per-item `gh` calls and let errors surface instead of redirecting them away. It is a less clever script — no shared loop body, some repetition — but it is honest about what it does not know. A status check whose failure mode is silence is worse than no status check at all, because it looks like coverage without providing any.\n\n## Takeaway\n\nBoth fixes share the same shape: the pipeline had a way to be technically green while being substantively wrong, whether by deploying an implicit reference or by hiding an error behind redirection. Neither problem shows up in a demo. Both show up eventually in production, at the worst time. Naming exactly what you deploy, and letting scripts fail loudly, turned out to matter more than any single test.',
      readingTimeMin: 2,
    },
    ar: {
      title: 'نشر بمعرّف SHA دقيق وتشغيل موثوق لخطوط CI/CD',
      slug: 'nashr-sha-daqiq-mawthuq',
      excerpt:
        'كيف أغلق تثبيت نشر الإنتاج على معرّف commit SHA دقيق — وإصلاح حلقة شل كانت تكتم أخطاء أداة `gh` بصمت — طريقتين هادئتين يمكن بهما لخط أنابيب أخضر أن يفعل الشيء الخطأ.',
      body: '## لماذا يحتاج النشر إلى اسم لا مجرد علامة خضراء\n\nنشر الإنتاج في هذه المنصة لا يُطلَق إلا عند دفع أو تشغيل يدوي (`workflow_dispatch`) على فرع `main` — لا `dev` أبدًا. يبدو هذا الحد بديهيًا حتى تتفحّص ما يَعِد به خط أنابيب أخضر فعليًا: هو يخبرك أن الشيفرة اجتازت الفحوص، لا أي شيفرة سيُنشَر تحديدًا. هذان ضمانان مختلفان، والخلط بينهما هو الطريق إلى نشر البناء الخطأ بضمير مرتاح.\n\n## التثبيت على معرّف SHA دقيق\n\nالحل هو تثبيت خطوة النشر على معرّف commit SHA دقيق بدلًا من "أيًّا كان ما يشير إليه `main` حاليًا". يحلّ سير العمل المعرّف مرة واحدة، ويمرّره صراحة عبر المهمة، ويرفض نشر أي شيء آخر — حتى لو تحرّك `main` في الثواني الفاصلة بين التشغيل والتنفيذ. اسم الفرع مؤشر قابل للتغيّر تحت قدميك؛ أما SHA فحقيقة ثابتة. النشر استنادًا إلى حقيقة بدلًا من مؤشر يزيل فئة كاملة من حوادث "نُشرت الشيفرة الخطأ" التي يستحيل تقريبًا إعادة إنتاجها بعد وقوعها.\n\n## علة أكثر خفاءً: أخطاء CLI مكتومة\n\nالعلة الأكثر إفادة لم تكن في تثبيت SHA — بل في نص برمجي لفحص حالة طلبات السحب قبل السماح بالنشر. كان يلفّ على أرقام الطلبات ببنية شل من هذا القبيل:\n\n```sh\nfor pr in $prs; do\n  set -- $pr\n  state=$(gh pr view "$1" --json state 2>/dev/null)\n  # ...\ndone\n```\n\nكان القصد من `2>/dev/null` إبعاد الضجيج عن السجل. لكن ما فعله فعليًا هو كتم كل فشل يصدر عن أداة `gh` — أخطاء المصادقة، وحدود المعدل، وتقسيم الكلمات الخاطئ الناتج عن `set --` — وترك النص البرمجي ينزلق إلى حالة افتراضية "غير معروفة". استمر خط الأنابيب، ولم يسجّل شيئًا مقلقًا، ولم تظهر العلة إلا حين سأل أحدهم لماذا طلب سحب مدموج بوضوح لا يزال يظهر بحالة "غير معروفة".\n\n## الإصلاح كان أقل ذكاءً لا أكثر\n\nاستبدلت الحلقة باستدعاءات مباشرة لـ `gh` لكل عنصر على حدة، وتركت الأخطاء تظهر بدل إعادة توجيهها بعيدًا. إنه نص برمجي أقل ذكاءً — بلا جسم حلقة مشترك، ومع بعض التكرار — لكنه صادق فيما لا يعرفه. فحص حالة يكون فشله صامتًا أسوأ من غياب الفحص أصلًا، لأنه يبدو تغطية دون أن يوفّرها.\n\n## الخلاصة\n\nيشترك الإصلاحان في الشكل نفسه: كان خط الأنابيب قادرًا على أن يكون أخضر تقنيًا بينما هو خاطئ جوهريًا، سواء بنشر مرجع ضمني أو بإخفاء خطأ خلف إعادة التوجيه. لا تظهر أيّ من العلتين في عرض تجريبي. تظهران في الإنتاج عاجلًا أم آجلًا، في أسوأ توقيت. تسمية ما يُنشَر بدقة، والسماح للنصوص البرمجية بالفشل بصوت مسموع، تبيّن أنهما أهمّ من أي اختبار منفرد.',
      readingTimeMin: 2,
    },
  },
  {
    categorySlug: 'architecture',
    publishAt: new Date('2025-09-23T09:00:00.000Z'),
    tagKeys: ['ci-cd', 'security'],
    en: {
      title: 'A Release Freeze That Protects Production',
      slug: 'release-freeze-protects-production',
      excerpt:
        'Why `main` stays pinned to the production baseline while feature work keeps flowing to `dev`, and the strict, merge-commit-only order promotion has to follow when the freeze lifts.',
      body: '## Freezing what is live, not what is moving\n\nAt some point every active codebase needs a boundary between “what is being built” and “what is actually running in production.” Here, that boundary is a release freeze: `main` stays pinned to the current production baseline while feature work keeps flowing through its normal path — feature branch to pull request to `dev`. Development does not stop; only the promotion of that development into production does.\n\n## A strict promotion order\n\nWhen it is time to lift the freeze, promotion follows a fixed sequence, and skipping a step is not allowed even under time pressure: merge `dev` into `main`, provision or update the public URL the release depends on, then deploy and run a post-deploy smoke check. Each step depends on the one before it having actually happened, not just having been intended. A freeze that can be bypassed under pressure is not a freeze — it is a suggestion.\n\n## Merge commits, not squashes\n\nThe `dev` → `main` merge is always a merge commit, never a squash. Squashing that particular merge collapses the entire history of what shipped into a single commit, which makes later bisection nearly useless — you lose the ability to tell which individual change in a large promotion actually caused a regression. A squash is fine for a single feature branch with one clear intent; it is the wrong tool for a promotion that carries weeks of independent changes.\n\n## Migrations only ever deploy\n\nSchema changes go out through `prisma migrate deploy` and nothing else. No ad-hoc `db push`, no manual schema edits against a live database. `migrate deploy` runs exactly the migrations already committed to the repository, in order, with no drift between what is in source control and what is in the database. It is a small constraint, but it is the difference between a migration history you can audit and one you have to reconstruct from memory.\n\n## Why the discipline is worth it\n\nNone of this is exotic. A freeze, an ordered promotion, merge commits over squashes, and a single migration command are all boring choices. But production incidents are rarely caused by a single dramatic mistake — they are caused by skipping a boring step once, under pressure, because everything looked fine. The freeze exists precisely for the moments when it is tempting to skip it.',
      readingTimeMin: 2,
    },
    ar: {
      title: 'تجميد إصدار يحمي بيئة الإنتاج',
      slug: 'tajmid-alisdar-yahmi-alintaj',
      excerpt:
        'لماذا يبقى `main` مثبَّتًا عند خط أساس الإنتاج بينما يستمر تدفّق العمل على الميزات إلى `dev`، والترتيب الصارم القائم على التزامات الدمج فقط الذي يجب اتّباعه عند رفع التجميد.',
      body: '## تجميد ما يعمل، لا ما يتغيّر\n\nتحتاج كل قاعدة شيفرة نشطة عند نقطة ما إلى حدّ فاصل بين "ما يُبنى" و"ما يعمل فعليًا في الإنتاج". هنا، هذا الحدّ هو تجميد الإصدار: يبقى فرع `main` مثبَّتًا عند خط الأساس الحالي للإنتاج، بينما يستمر العمل على الميزات عبر مساره المعتاد — من فرع الميزة إلى طلب سحب إلى `dev`. التطوير لا يتوقف؛ ما يتوقف فقط هو ترقية ذلك التطوير إلى الإنتاج.\n\n## ترتيب صارم للترقية\n\nحين يحين وقت رفع التجميد، تتبع الترقية تسلسلًا ثابتًا لا يجوز تخطي أي خطوة منه حتى تحت ضغط الوقت: دمج `dev` في `main`، ثم توفير أو تحديث الرابط العام الذي يعتمد عليه الإصدار، ثم النشر وتشغيل فحص دخان بعد النشر. تعتمد كل خطوة على أن سابقتها قد حدثت فعلًا، لا أنها كانت مقصودة فقط. التجميد الذي يمكن تجاوزه تحت الضغط ليس تجميدًا — بل مجرد اقتراح.\n\n## التزامات دمج، لا سحق\n\nدمج `dev` في `main` هو دائمًا التزام دمج (merge commit)، لا سحق (squash) أبدًا. سحق هذا الدمج تحديدًا يضغط كل تاريخ ما تم شحنه في التزام واحد، ما يجعل التقسيم الثنائي اللاحق شبه عديم الفائدة — تفقد القدرة على معرفة أي تغيير فردي داخل ترقية كبيرة تسبّب فعليًا في تراجع. السحق مناسب لفرع ميزة واحد بقصد واضح؛ لكنه الأداة الخطأ لترقية تحمل أسابيع من تغييرات مستقلة.\n\n## الترحيلات تُنشر فقط\n\nتخرج تغييرات المخطط عبر `prisma migrate deploy` ولا شيء غيره. لا `db push` عشوائي، ولا تعديلات يدوية على مخطط قاعدة بيانات حيّة. يشغّل `migrate deploy` بالضبط الترحيلات المُلتزَم بها مسبقًا في المستودع، بالترتيب، دون انزياح بين ما في ضبط الإصدار وما في قاعدة البيانات. قيد صغير، لكنه الفارق بين تاريخ ترحيل يمكن تدقيقه وآخر يجب إعادة بنائه من الذاكرة.\n\n## لماذا يستحق هذا الانضباط\n\nلا شيء من هذا غريب. التجميد، والترقية المرتّبة، والتزامات الدمج بدل السحق، وأمر ترحيل واحد — كلها خيارات بسيطة. لكن حوادث الإنتاج نادرًا ما يسبّبها خطأ درامي واحد — بل يسبّبها تخطي خطوة بسيطة مرة واحدة، تحت الضغط، لأن كل شيء بدا سليمًا. التجميد موجود تحديدًا للحظات التي يكون فيها تخطيه مغريًا.',
      readingTimeMin: 2,
    },
  },
  {
    categorySlug: 'architecture',
    publishAt: new Date('2025-10-28T09:00:00.000Z'),
    tagKeys: ['security', 'nestjs'],
    en: {
      title: 'Draft Invisibility: Not Leaking What Isn’t Published',
      slug: 'draft-invisibility-not-leaking-unpublished',
      excerpt:
        'Unpublished content should be as invisible as content that was never created — a direct URL returns 404, scheduling resolves itself automatically, and previews go through a minted per-item token instead of a public endpoint.',
      body: '## The leak that matters is not the content\n\nThe obvious rule for unpublished content is “do not show it publicly.” The less obvious rule — the one that actually matters — is “do not reveal that it exists.” A draft, a scheduled post, or an archived article should return a 404 for a direct request to its URL, exactly the same 404 a nonexistent slug would return. If a request to an unpublished slug behaved any differently from a request to a slug that was never used — a 403 instead of a 404, a different error shape, even a slower response — that difference is itself information. It tells a probing request that something is there, waiting.\n\n## Existence is not a public fact\n\nThis is the part that is easy to get wrong by accident: an endpoint can correctly refuse to return a draft’s content while still leaking its existence through status codes, error messages, or timing. The fix is to treat existence itself as private for anything that is not published — the public API’s view of an unpublished item is identical to its view of an item that was never created.\n\n## Scheduling closes the gap automatically\n\nScheduled posts complicate this slightly, because “not yet published” becomes “published” without any code deploying or any manual flag flipping — it happens purely as a function of time crossing the `publishAt` instant. The public read path checks status and publish time together on every request, so the same query that returns 404 a minute before the scheduled time returns the article a minute after it, with no cache to invalidate and no job to run.\n\n## Previewing without a public door\n\nEditors still need to see unpublished content before it goes live — a draft, or a post scheduled for next week. That need does not justify a public preview endpoint. Instead, preview access goes through a minted, per-item token: a value generated for that specific piece of content, checked against that content specifically, and not usable to enumerate or guess at anything else in the system. It is a narrow door built for one purpose, rather than a public endpoint with an exception carved into it.\n\n## Takeaway\n\nMost access-control bugs I have seen are not about someone reading content they should not — they are about someone learning that content exists when they should not know that either. Treating existence as part of what is protected, not just content, is a small mental shift with an outsized effect on what a system actually leaks.',
      readingTimeMin: 2,
    },
    ar: {
      title: 'اختفاء المسوّدات: عدم تسريب ما لم يُنشر',
      slug: 'ikhtifa-almusawwadat',
      excerpt:
        'ينبغي أن يكون المحتوى غير المنشور غير مرئي تمامًا كمحتوى لم يُنشأ قط — يعيد الرابط المباشر 404، وتُحلّ الجدولة نفسها تلقائيًا، وتمر المعاينة عبر رمز مُصكوك لكل عنصر بدل نقطة نهاية عامة.',
      body: '## التسريب المهم ليس المحتوى\n\nالقاعدة الواضحة للمحتوى غير المنشور هي "لا تُظهره للعامة". أما القاعدة الأقل وضوحًا — وهي التي تهمّ فعليًا — فهي "لا تكشف أنه موجود أصلًا". ينبغي لمسودة، أو منشور مجدوَل، أو مقال مؤرشَف أن يُعيد استجابة 404 لأي طلب مباشر على رابطه، هي نفس استجابة الـ404 التي يعيدها رابط غير موجود أصلًا. لو تصرّف طلب على رابط غير منشور بأي شكل مختلف عن طلب على رابط لم يُستخدم قط — 403 بدل 404، أو شكل خطأ مختلف، أو حتى استجابة أبطأ — فذلك الاختلاف نفسه معلومة. يخبر أي طلب استكشافي أن هناك شيئًا ما ينتظر.\n\n## الوجود ليس حقيقة عامة\n\nهذا هو الجزء الذي يسهل إخفاقه دون قصد: قد ترفض نقطة نهاية بشكل صحيح إعادة محتوى مسودة، لكنها تسرّب وجودها عبر رموز الحالة، أو رسائل الخطأ، أو التوقيت. الحل هو معاملة الوجود نفسه بوصفه خاصًا لأي شيء غير منشور — نظرة الواجهة البرمجية العامة إلى عنصر غير منشور مطابقة تمامًا لنظرتها إلى عنصر لم يُنشأ قط.\n\n## الجدولة تُغلق الفجوة تلقائيًا\n\nتُعقّد المنشورات المجدولة هذا الأمر قليلًا، لأن حالة "لم يُنشر بعد" تتحول إلى "منشور" دون نشر أي شيفرة أو قلب أي علامة يدويًا — يحدث ذلك بحكم الزمن حين يتجاوز لحظة `publishAt`. يفحص مسار القراءة العام الحالة ووقت النشر معًا في كل طلب، فنفس الاستعلام الذي يعيد 404 قبل الموعد المجدوَل بدقيقة يعيد المقال بعد الموعد بدقيقة، دون تخزين مؤقت يجب إبطاله ولا مهمة يجب تشغيلها.\n\n## معاينة دون باب عام\n\nيحتاج المحرّرون رغم ذلك إلى رؤية محتوى غير منشور قبل إطلاقه — مسودة، أو منشور مجدوَل للأسبوع القادم. هذه الحاجة لا تبرّر نقطة نهاية معاينة عامة. بدلًا من ذلك، يمر الوصول للمعاينة عبر رمز مُصكوك لكل عنصر على حدة: قيمة تُولَّد لهذا المحتوى تحديدًا، وتُفحَص مقابله هو فقط، ولا يمكن استخدامها لسرد أو تخمين أي شيء آخر في النظام. إنه باب ضيّق بُني لغرض واحد، لا نقطة نهاية عامة استُثني منها استثناء.\n\n## الخلاصة\n\nمعظم علل التحكم بالوصول التي رأيتها لم تكن عن قراءة أحدهم محتوى لا ينبغي له قراءته — بل عن معرفته أن المحتوى موجود أصلًا وهو ما لا ينبغي له معرفته أيضًا. معاملة الوجود جزءًا مما يُحمى، لا المحتوى وحده، تحوّل ذهني صغير بأثر كبير على ما يسرّبه النظام فعليًا.',
      readingTimeMin: 2,
    },
  },
  {
    categorySlug: 'engineering',
    publishAt: new Date('2025-11-30T09:00:00.000Z'),
    tagKeys: ['security', 'testing'],
    en: {
      title: 'Protecting the Local .env and Isolating Tests',
      slug: 'protecting-local-env-isolating-tests',
      excerpt:
        'Why tests here run against an external temporary environment and a throwaway database, never the real local `.env` — and why destructive resets are avoided even when they would be convenient.',
      body: '## A rule with a story behind it\n\nSome rules exist because a document said so; others exist because something actually broke. This one is the second kind: tests must never read or overwrite the real local `.env`. The rule is simple to state and easy to violate accidentally — a test helper that “just” loads environment variables for convenience, or a setup script that resets configuration to a known state, can silently point at the file a developer is using for actual local work.\n\n## What isolation actually means here\n\nIsolation means tests get their own environment entirely — an external temporary configuration and a throwaway database, provisioned specifically for the test run and discarded afterward. Nothing in the test suite touches the developer’s working `.env`, and nothing in the test suite assumes it can regenerate that file safely if something goes wrong. The clean-environment check that verifies a fresh setup works from scratch runs against that same throwaway database, never against anything with real local data in it.\n\n## Destructive resets are a smell, not a convenience\n\nIt is tempting to reach for a full reset — drop the database, wipe the environment file, start clean — whenever a test needs a known starting state. That convenience has a cost: a reset that is safe in a disposable test container is not safe if it is ever pointed, even briefly, at a real environment. The safer pattern is additive and scoped: build up exactly the state a test needs in an isolated database, and avoid destructive operations that only make sense when you are certain about what they are touching.\n\n## What it looks like when this goes wrong\n\nThe failure mode is not dramatic in the moment — a test run that quietly targets the wrong environment does not throw an error, it just does damage. The `.env` gets overwritten with test values, or a database that had real seed data comes back empty, and the first sign of trouble is a developer noticing their local setup no longer looks the way it did an hour ago. There is no exception to catch, because from the code’s perspective everything worked.\n\n## Takeaway\n\nThe guarantee I want from a test suite is not just “the tests pass” — it is “the tests cannot touch anything I would have to explain to someone.” Isolating environment and data by construction, rather than trusting every test author to remember a rule, is what actually delivers that guarantee.',
      readingTimeMin: 2,
    },
    ar: {
      title: 'حماية ملف .env المحلي وعزل الاختبارات',
      slug: 'himayat-env-almahalli-wa-azl-alikhtibarat',
      excerpt:
        'لماذا تعمل الاختبارات هنا مقابل بيئة مؤقتة خارجية وقاعدة بيانات يُستغنى عنها، لا ملف `.env` المحلي الحقيقي أبدًا — ولماذا تُتجنَّب إعادة الضبط المدمِّرة حتى حين تكون مريحة.',
      body: '## قاعدة لها قصة خلفها\n\nبعض القواعد توجد لأن مستندًا ما نصّ عليها؛ وبعضها يوجد لأن شيئًا ما تعطّل فعلًا. هذه من النوع الثاني: يجب ألا تقرأ الاختبارات ملف `.env` المحلي الحقيقي أو تكتب فوقه أبدًا. القاعدة سهلة الصياغة وسهلة الانتهاك عن غير قصد — دالة مساعدة في الاختبارات "تكتفي" بتحميل متغيرات البيئة للراحة، أو نص إعداد يعيد ضبط التهيئة إلى حالة معروفة، قد يشير بصمت إلى الملف الذي يستخدمه المطوّر فعليًا في عمله المحلي.\n\n## ماذا يعني العزل هنا فعليًا\n\nالعزل يعني أن للاختبارات بيئتها الخاصة تمامًا — تهيئة مؤقتة خارجية وقاعدة بيانات يُستغنى عنها، تُهيَّآن خصيصًا لتشغيل الاختبار وتُهملان بعده. لا شيء في حزمة الاختبارات يلمس ملف `.env` الذي يعمل عليه المطوّر، ولا شيء فيها يفترض أنه يمكنه إعادة توليد ذلك الملف بأمان إن حدث خطأ ما. فحص البيئة النظيفة الذي يتحقق من عمل إعداد جديد من الصفر يعمل على قاعدة البيانات المؤقتة نفسها، لا على أي شيء يحمل بيانات محلية حقيقية.\n\n## إعادة الضبط المدمِّرة عرَض لا راحة\n\nمن المغري اللجوء إلى إعادة ضبط كاملة — إسقاط قاعدة البيانات، ومسح ملف البيئة، والبدء نظيفًا — كلما احتاج اختبار إلى حالة بداية معروفة. لهذه الراحة ثمن: إعادة الضبط الآمنة في حاوية اختبار يُستغنى عنها ليست آمنة إن أُشير بها، ولو للحظة، إلى بيئة حقيقية. النمط الأكثر أمانًا تراكمي ومحدود النطاق: ابنِ بالضبط الحالة التي يحتاجها الاختبار في قاعدة بيانات معزولة، وتجنّب العمليات المدمِّرة التي لا معنى لها إلا حين تكون متأكدًا تمامًا مما تلمسه.\n\n## كيف يبدو الأمر حين يحدث خطأ\n\nنمط الفشل هنا غير درامي في لحظته — تشغيل اختبار يستهدف بصمت البيئة الخطأ لا يرمي خطأ، بل يُحدث ضررًا فحسب. يُكتب فوق `.env` بقيم اختبارية، أو تعود قاعدة بيانات كانت تحمل بيانات أولية حقيقية فارغة، وأول إشارة على المشكلة أن يلاحظ مطوّر أن إعداده المحلي لم يعد كما كان قبل ساعة. لا استثناء يُلتقط، لأنه من منظور الشيفرة كل شيء نجح.\n\n## الخلاصة\n\nالضمان الذي أريده من حزمة اختبارات ليس فقط "الاختبارات تنجح" — بل "الاختبارات لا يمكنها لمس أي شيء سأضطر لتبريره لأحد". عزل البيئة والبيانات بالتصميم، لا بالثقة في أن كل كاتب اختبار سيتذكر قاعدة، هو ما يحقق هذا الضمان فعليًا.',
      readingTimeMin: 2,
    },
  },
  {
    categorySlug: 'architecture',
    publishAt: new Date('2026-01-18T09:00:00.000Z'),
    tagKeys: ['nestjs', 'security'],
    en: {
      title: 'Hardening a Content API with Boring, Effective Controls',
      slug: 'hardening-content-api-boring-effective-controls',
      excerpt:
        'A 1 MiB body limit with an RFC 7807 response, honeypot-plus-time-trap-plus-rate-limiting for the contact form, automatic retention cleanup, and a latency smoke check — none of it exotic, all of it load-bearing.',
      body: '## Security work that does not look like security work\n\nNone of the controls in this article are dramatic. There is no exotic threat model here — just a handful of boring, specific limits that close off ordinary ways an API gets abused, applied consistently rather than cleverly.\n\n## A body-size limit with a real error shape\n\nRequest bodies are capped at 1 MiB. That number is not arbitrary caution — it is sized for what the API’s payloads actually need, with room to spare, and nothing more. Exceeding it does not produce a generic failure; it returns a proper RFC 7807 problem response with a 413 status, so a client integrating against the API gets a machine-readable reason rather than a mystery disconnect.\n\n## Contact-form abuse, without a CAPTCHA\n\nThe contact form is the most public-facing write path in the system, which makes it the natural target for spam. Rather than putting a CAPTCHA in front of a real visitor, abuse is handled with three quieter controls layered together: a honeypot field that a human never fills in but a bot reliably does, a time-trap that rejects submissions completed faster than a person plausibly could, and rate limiting on top of both. None of the three is sufficient alone; together they catch most automated submissions without asking a legitimate visitor to prove anything.\n\n## Data does not get to live forever\n\nArchived contact messages are purged automatically twelve months after they were archived, driven by an `archivedAt` timestamp and a daily cron job. This is not primarily a storage optimization — it is a bound on how long old, sensitive submissions sit around as a liability with no continuing benefit. Retention that has to be remembered and done manually eventually does not get done; retention driven by a scheduled job does not have that failure mode.\n\n## Watching for the slow failure\n\nA latency smoke check runs to catch the failure mode that is easy to miss: an API that is still returning correct responses but taking meaningfully longer to do it. Correctness monitoring alone will not catch that regression, because nothing is technically wrong — until it is slow enough to matter, and by then the cause is much less visible.\n\n## Takeaway\n\nNone of these controls are individually impressive. What they have in common is that each closes a specific, ordinary way a content API tends to get hurt — oversized payloads, form spam, indefinitely retained data, silent slowdowns — rather than reaching for something more elaborate than the actual threat warrants.',
      readingTimeMin: 2,
    },
    ar: {
      title: 'تحصين واجهة برمجية للمحتوى بضوابط بسيطة وفعّالة',
      slug: 'tahsin-wajiha-barmajiya-lilmuhtawa',
      excerpt:
        'حدّ حجم طلب بـ1 ميبيبايت مع استجابة RFC 7807، ومصيدة عسل وفخّ زمني وتحديد معدل لنموذج التواصل، وتنظيف احتفاظ تلقائي، وفحص دخان لزمن الاستجابة — لا شيء منها غريب، وكلها ضرورية.',
      body: '## عمل أماني لا يبدو كعمل أماني\n\nلا شيء من الضوابط في هذا المقال درامي. لا يوجد هنا نموذج تهديد غريب — فقط حفنة من القيود البسيطة والمحدَّدة التي تغلق طرقًا اعتيادية لإساءة استخدام واجهة برمجية، مطبَّقة باتساق لا بذكاء مفرط.\n\n## حدّ لحجم الطلب بشكل خطأ حقيقي\n\nتُحدَّد أجسام الطلبات بحد أقصى 1 ميبيبايت. هذا الرقم ليس حذرًا اعتباطيًا — بل مقاس على ما تحتاجه حمولات الواجهة البرمجية فعليًا، مع هامش، لا أكثر. تجاوزه لا ينتج فشلًا عامًا؛ بل يعيد استجابة مشكلة سليمة وفق RFC 7807 بحالة 413، فيحصل العميل المتكامل مع الواجهة البرمجية على سبب قابل للقراءة آليًا بدل انقطاع غامض.\n\n## إساءة استخدام نموذج التواصل، دون كابتشا\n\nنموذج التواصل هو أكثر مسار كتابة مواجه للعامة في النظام، ما يجعله الهدف الطبيعي للبريد المزعج. بدلًا من وضع كابتشا أمام زائر حقيقي، تُعالَج الإساءة بثلاثة ضوابط أهدأ تعمل معًا: حقل مصيدة عسل لا يملؤه إنسان أبدًا لكن يملؤه الروبوت باستمرار، وفخّ زمني يرفض الإرسالات المكتملة أسرع مما يستطيع إنسان معقول، وتحديد لمعدل الطلبات فوقهما. لا يكفي أيّ من الثلاثة وحده؛ لكنها معًا تلتقط معظم الإرسالات الآلية دون مطالبة زائر شرعي بإثبات أي شيء.\n\n## البيانات لا تعيش إلى الأبد\n\nتُحذَف رسائل التواصل المؤرشَفة تلقائيًا بعد اثني عشر شهرًا من أرشفتها، بالاعتماد على طابع زمني `archivedAt` ومهمة مجدولة يومية. هذا ليس تحسينًا للتخزين في الأساس — بل حدّ لطول بقاء إرسالات قديمة وحسّاسة كعبء دون فائدة مستمرة. الاحتفاظ الذي يجب تذكّره وتنفيذه يدويًا لا يُنفَّذ في النهاية؛ أما الاحتفاظ الذي تقوده مهمة مجدولة فلا يحمل نمط الفشل هذا.\n\n## مراقبة الفشل البطيء\n\nيعمل فحص دخان لزمن الاستجابة لالتقاط نمط فشل يسهل تفويته: واجهة برمجية لا تزال تعيد استجابات صحيحة لكنها تستغرق وقتًا أطول بشكل ملموس لتفعل ذلك. مراقبة الصحة وحدها لن تلتقط هذا التراجع، لأن لا شيء خاطئ تقنيًا — إلى أن يصبح البطء كبيرًا بما يكفي ليهمّ، وعندها يصبح السبب أقل وضوحًا بكثير.\n\n## الخلاصة\n\nلا شيء من هذه الضوابط مبهر منفردًا. ما يشترك فيه جميعها أن كل ضابط يغلق طريقة محدَّدة واعتيادية تتضرر بها واجهة برمجية للمحتوى عادةً — حمولات مفرطة الحجم، وبريد مزعج في النماذج، وبيانات محتفَظ بها إلى ما لا نهاية، وتباطؤ صامت — بدل اللجوء إلى شيء أكثر تعقيدًا مما يستدعيه التهديد الفعلي.',
      readingTimeMin: 2,
    },
  },
  {
    categorySlug: 'engineering',
    publishAt: new Date('2026-03-05T09:00:00.000Z'),
    tagKeys: ['rtl', 'i18n', 'accessibility'],
    en: {
      title: 'RTL as Architecture, Not Translation',
      slug: 'rtl-as-architecture-not-translation',
      excerpt:
        'Logical CSS properties instead of left/right, directional icons that mirror while semantic ones don’t, and Latin identifiers that stay LTR inside Arabic text via `bdi` — the mechanics of treating direction as a first-class layout input.',
      body: '## Treating direction as a first-class input\n\nIt is tempting to think of right-to-left support as a translation detail — flip some text, mirror a layout, done. Treated that way, RTL always ends up as an afterthought bolted onto a component library that was designed assuming left-to-right. The more durable approach is to treat writing direction as architecture: a property the layout system respects from the start, not a mode applied on top of it later.\n\n## Logical properties, not left and right\n\nThe concrete mechanism is CSS logical properties. `margin-inline-start` and `padding-inline-end` describe position relative to the reading direction; `margin-left` and `padding-right` describe position relative to the screen. Once direction flips, only the logical properties keep meaning what they meant. In this codebase, physical left/right properties are a lint error, not a style guideline — which turns “did we handle RTL here” from a manual review question into something the toolchain catches automatically, the same way a type error gets caught before it ships.\n\n## Icons do not all mirror the same way\n\nDirectional icons — arrows, chevrons, anything that implies “next” or “back” — need to flip with the layout, because their meaning is spatial. Icons that represent something else entirely, like a play button or a settings gear, should not flip just because the surrounding layout did; mirroring them changes nothing about their meaning and just makes them look wrong. Getting this distinction right means classifying icons by what they represent, not applying a blanket mirror rule to every glyph on the page.\n\n## Latin text still needs to behave like Latin text\n\nArabic pages routinely contain identifiers, code snippets, and product names that are inherently Latin-script and left-to-right — a package name, a URL, a variable in a fenced code block. Wrapping that content in `bdi` (bidirectional isolation) keeps it rendering left-to-right and keeps its punctuation from reordering, without requiring the surrounding Arabic paragraph to know or care that an LTR island exists inside it.\n\n## Neither locale is the “real” one\n\nThe test that matters is not “does the Arabic version work” — it is whether a bilingual visitor moving between the two locales can tell which one was built first and which one was retrofitted. If there is a tell, direction was treated as a translation step. If there is not, it was treated as architecture.\n\n## Takeaway\n\nRTL support that is added late always looks like RTL support that was added late — mirrored icons that should not be, hardcoded left/right values that quietly break, Latin text that reorders where it should not. Building direction into the layout system from day one is the only way I have found to avoid that tell entirely.',
      readingTimeMin: 2,
    },
    ar: {
      title: 'الاتجاه من اليمين إلى اليسار بوصفه بنية لا ترجمة',
      slug: 'alittijah-min-alyamin-ila-alyasar-bunya',
      excerpt:
        'خصائص CSS منطقية بدل اليمين واليسار، وأيقونات اتجاهية تنعكس بينما لا تنعكس الدلالية منها، ومُعرِّفات لاتينية تبقى من اليسار إلى اليمين داخل النص العربي عبر `bdi` — آليات معاملة الاتجاه مدخلًا أساسيًا في نظام التخطيط.',
      body: '## معاملة الاتجاه مدخلًا أساسيًا لا تفصيلًا لاحقًا\n\nمن المغري التفكير في دعم الاتجاه من اليمين إلى اليسار كتفصيلة ترجمة — اعكس بعض النص، اعكس تخطيطًا، وانتهى الأمر. حين يُعامَل بهذا الشكل، ينتهي دائمًا كفكرة لاحقة تُلحَق بمكتبة مكوّنات صُمِّمت أصلًا على افتراض الاتجاه من اليسار إلى اليمين. النهج الأكثر ديمومة هو معاملة اتجاه الكتابة بوصفه بنية معمارية: خاصية يحترمها نظام التخطيط منذ البداية، لا نمطًا يُطبَّق فوقه لاحقًا.\n\n## خصائص منطقية، لا يمين ويسار\n\nالآلية الملموسة هي خصائص CSS المنطقية. تصف `margin-inline-start` و`padding-inline-end` الموضع نسبةً إلى اتجاه القراءة؛ بينما تصف `margin-left` و`padding-right` الموضع نسبةً إلى الشاشة. بمجرد أن ينعكس الاتجاه، تبقى الخصائص المنطقية وحدها تحمل المعنى نفسه. في هذه الشيفرة، الخصائص المادية لليمين واليسار خطأ في الفحص الآلي (lint)، لا مجرد إرشاد أسلوبي — ما يحوّل سؤال "هل عالجنا الاتجاه هنا" من مراجعة يدوية إلى شيء تلتقطه سلسلة الأدوات تلقائيًا، تمامًا كما يُلتقط خطأ في الأنواع قبل الشحن.\n\n## الأيقونات لا تنعكس كلّها بالطريقة نفسها\n\nتحتاج الأيقونات الاتجاهية — الأسهم، ورموز التنقل، وأي شيء يعني "التالي" أو "السابق" — إلى الانعكاس مع التخطيط، لأن معناها مكاني. أما الأيقونات التي تمثّل شيئًا آخر تمامًا، كزر التشغيل أو ترس الإعدادات، فلا ينبغي أن تنعكس لمجرد أن التخطيط المحيط انعكس؛ عكسها لا يغيّر شيئًا في معناها بل يجعلها تبدو خاطئة فحسب. ضبط هذا التمييز يعني تصنيف الأيقونات وفق ما تمثّله، لا تطبيق قاعدة عكس شاملة على كل رمز في الصفحة.\n\n## النص اللاتيني لا يزال يحتاج أن يتصرف كنص لاتيني\n\nتحتوي الصفحات العربية عادةً على مُعرِّفات، ومقاطع شيفرة، وأسماء منتجات لاتينية الطبع من اليسار إلى اليمين بطبيعتها — اسم حزمة، أو رابط، أو متغيّر داخل مقطع شيفرة. لفّ هذا المحتوى بـ `bdi` (العزل ثنائي الاتجاه) يُبقيه يُعرض من اليسار إلى اليمين ويمنع ترقيمه من إعادة الترتيب، دون أن يحتاج النص العربي المحيط إلى معرفة أن جزيرة من اليسار إلى اليمين موجودة داخله أو الاهتمام بذلك.\n\n## لا لغة هي "الأصلية"\n\nالاختبار الذي يهمّ ليس "هل تعمل النسخة العربية" — بل هل يستطيع زائر ثنائي اللغة يتنقّل بين اللغتين أن يعرف أيّهما بُني أولًا وأيّهما أُضيف لاحقًا. إن وُجدت علامة تكشف ذلك، فقد عومل الاتجاه كخطوة ترجمة. وإن لم توجد، فقد عومل بوصفه بنية معمارية.\n\n## الخلاصة\n\nدعم الاتجاه من اليمين إلى اليسار الذي يُضاف متأخرًا يبدو دائمًا كذلك — أيقونات معكوسة لا ينبغي عكسها، وقيم يمين/يسار ثابتة تنكسر بصمت، ونص لاتيني يُعاد ترتيبه حيث لا ينبغي. بناء الاتجاه داخل نظام التخطيط منذ اليوم الأول هو الطريقة الوحيدة التي وجدتها لتفادي هذه العلامة كليًا.',
      readingTimeMin: 2,
    },
  },
  {
    categorySlug: 'tutorials',
    publishAt: new Date('2026-05-14T09:00:00.000Z'),
    tagKeys: ['design-systems', 'accessibility', 'vue'],
    en: {
      title: 'Designing with Semantic Tokens and a Single Accent',
      slug: 'designing-semantic-tokens-single-accent',
      excerpt:
        'Naming colors by the role they play rather than their hex value, spending a single brand accent deliberately, and building dark-UI depth from borders and surface steps instead of shadows.',
      body: '## Naming what a color means, not what it is\n\nA raw hex value tells you nothing about why it was chosen. A semantic token — `color-surface-raised`, `color-text-muted`, `color-border-subtle` — tells you what role it plays in the interface, which means the value behind it can change without every component that uses it needing to change too. That indirection is the entire point: a rebrand, a dark-mode variant, or a contrast fix becomes a token update instead of a search-and-replace across a codebase.\n\n## One accent, used deliberately\n\nA single brand accent color, used consistently and sparingly, reads as more considered than a palette with four or five colors competing for attention. The accent marks the one thing on a screen that wants a click — a primary action, a link, a focused state — and nothing else. When everything is colorful, nothing stands out; when almost nothing is, the one colored element does the job a bright palette was trying and failing to do.\n\n## Depth without shadows\n\nIn a light UI, a drop shadow reads as depth because it mimics how light behaves. In a dark UI, that same shadow often reads as mud, because there is no bright background for it to contrast against. Depth in a dark interface comes instead from borders and surface steps — a slightly lighter background for an element that sits above another, a hairline border where a shadow would have gone. It is a subtler technique, and it holds up in a way shadows on dark backgrounds usually do not.\n\n## Typography carries more weight than color\n\nBefore reaching for a new color to distinguish two pieces of content, it is worth asking whether type does the job better: a heading versus a body size, a weight change, tighter or looser line height. Typography-first hierarchy tends to age better than color-coded hierarchy, because it keeps working even in a reduced-color context — print, a colorblind-safe mode, or a screen reader’s structural outline.\n\n## Takeaway\n\nNone of these are original ideas — they are common ground across most mature design systems. What they share is a bias toward restraint: name things by meaning, spend color deliberately, build depth from structure rather than effects, and let type carry hierarchy before color has to.',
      readingTimeMin: 2,
    },
    ar: {
      title: 'التصميم برموز دلالية ولون تمييز واحد',
      slug: 'altasmim-birumuz-dilaliya',
      excerpt:
        'تسمية الألوان وفق الدور الذي تؤديه لا قيمتها الست عشرية، وإنفاق لون تمييز واحد للعلامة عن قصد، وبناء عمق الواجهة الداكنة من الحدود ودرجات السطح بدل الظلال.',
      body: '## تسمية معنى اللون، لا ماهيته\n\nقيمة hex خام لا تخبرك بشيء عن سبب اختيارها. أما الرمز الدلالي — مثل `color-surface-raised` أو `color-text-muted` أو `color-border-subtle` — فيخبرك بالدور الذي يؤديه في الواجهة، ما يعني أن القيمة خلفه يمكن أن تتغيّر دون أن يحتاج كل مكوّن يستخدمها إلى التغيّر أيضًا. هذا التوسّط هو الغاية بأكملها: تصبح إعادة العلامة التجارية، أو نسخة الوضع الداكن، أو إصلاح التباين تحديثًا لرمز بدل بحث واستبدال عبر قاعدة الشيفرة كاملة.\n\n## لون تمييز واحد، يُستخدَم عن قصد\n\nلون تمييز واحد للعلامة، يُستخدَم باتساق وباقتصاد، يُقرأ أكثر اتزانًا من لوحة بأربعة أو خمسة ألوان تتنافس على الانتباه. لون التمييز يُعلِّم الشيء الوحيد في الشاشة الذي يريد نقرة — إجراء رئيسي، أو رابط، أو حالة تركيز — ولا شيء غيره. حين يكون كل شيء ملوَّنًا، لا شيء يبرز؛ وحين لا يكون شيء تقريبًا كذلك، يؤدي العنصر الملوَّن الوحيد المهمة التي كانت لوحة زاهية تحاول أداءها وتفشل.\n\n## عمق دون ظلال\n\nفي واجهة فاتحة، يُقرأ الظل المسقَط كعمق لأنه يحاكي سلوك الضوء. في واجهة داكنة، غالبًا ما يُقرأ الظل نفسه كبقعة موحلة، لأن لا خلفية ساطعة يتباين معها. يأتي العمق في واجهة داكنة بدلًا من ذلك من الحدود ودرجات السطح — خلفية أفتح قليلًا لعنصر يعلو عنصرًا آخر، أو حدّ شعرة رفيع حيث كان سيوضع ظل. إنها تقنية أدق، وتصمد بطريقة لا تصمد بها الظلال عادةً على خلفيات داكنة.\n\n## الطباعة تحمل وزنًا أكبر من اللون\n\nقبل اللجوء إلى لون جديد للتمييز بين قطعتي محتوى، يستحق الأمر سؤال ما إذا كانت الطباعة تؤدي المهمة بشكل أفضل: عنوان مقابل حجم نص أساسي، أو تغيير وزن الخط، أو ارتفاع سطر أضيق أو أوسع. التراتبية القائمة على الطباعة أولًا تميل إلى الصمود بشكل أفضل من التراتبية المرمَّزة باللون، لأنها تستمر في العمل حتى في سياق ألوان محدودة — الطباعة الورقية، أو وضع آمن لعمى الألوان، أو المخطط البنيوي لقارئ الشاشة.\n\n## الخلاصة\n\nلا شيء من هذا فكرة أصيلة — إنها أرضية مشتركة عبر معظم أنظمة التصميم الناضجة. ما تشترك فيه هو ميل نحو الانضباط: سمِّ الأشياء بمعناها، وأنفِق اللون عن قصد، وابنِ العمق من البنية لا من التأثيرات، ودَع الطباعة تحمل التراتبية قبل أن يُضطر اللون لذلك.',
      readingTimeMin: 2,
    },
  },
  {
    categorySlug: 'tutorials',
    publishAt: new Date('2026-07-08T09:00:00.000Z'),
    tagKeys: ['performance', 'nuxt'],
    en: {
      title: 'Staying Inside a Performance Budget with Nuxt',
      slug: 'staying-inside-performance-budget-nuxt',
      excerpt:
        'SSR for crawlable content, explicit dimensions for zero layout shift, server-only syntax highlighting, and per-route size limits enforced in CI — treating performance as a hard budget rather than a metric checked after the fact.',
      body: '## A budget is a constraint, not a report\n\nPerformance numbers that only get checked after a release are a report card, not a budget. A budget is enforced before the fact — a size limit per route that fails a CI build the same way a type error or a failing test would. Framing performance as a hard constraint, rather than a metric to review later, is what keeps a page from drifting slowly heavier over months of small, individually reasonable additions.\n\n## SSR for what needs to be found\n\nContent that needs to be crawlable and indexable is server-rendered, full stop. Client-side rendering can still deliver a fast experience for the visitor already on the page, but it delivers nothing to a crawler that does not execute JavaScript the way a browser does, and it delays the first paint for a real visitor who has to wait for a script to run before seeing content that could have arrived in the initial HTML.\n\n## Zero layout shift is a dimension problem\n\nCumulative layout shift is, in the overwhelming majority of cases, an unset-dimension problem: an image or embed that has no reserved space, so the page reflows once it loads. Setting explicit width and height — or an aspect-ratio box — on every piece of media reserves that space before anything downloads, which is enough on its own to get CLS to zero on most pages, no clever measurement required.\n\n## Highlighting without shipping a highlighter\n\nSyntax highlighting for code blocks is rendered entirely server-side, so no highlighting library or grammar definitions ship to the client at all. The visitor gets fully-highlighted code in the initial HTML; the client-side JavaScript budget never has to account for a dependency whose only job was to color some text that was already static by the time it mattered.\n\n## No script gets in by default\n\nThird-party scripts are the most common way a budget gets blown without anyone touching application code — an analytics snippet, a widget, an embed, each adding its own weight and its own third-party requests. The default here is zero third-party scripts; anything added has to justify its cost explicitly rather than sneaking in because it was easy to paste in a script tag.\n\n## Takeaway\n\nNone of these techniques are exotic — they are standard tools applied consistently and enforced automatically rather than left to good intentions. A budget only works if breaking it fails the build; everything else follows from that one constraint.',
      readingTimeMin: 2,
    },
    ar: {
      title: 'البقاء ضمن ميزانية أداء مع Nuxt',
      slug: 'albaqaa-dimn-mizaniyat-ada-nuxt',
      excerpt:
        'تصيير من جانب الخادم للمحتوى القابل للزحف، وأبعاد صريحة لإزاحة تخطيط صفرية، وتمييز شيفرة من جانب الخادم فقط، وحدود حجم لكل مسار تُفرَض في التكامل المستمر — معاملة الأداء ميزانية صارمة لا مقياسًا يُفحَص لاحقًا.',
      body: '## الميزانية قيد لا تقرير\n\nأرقام أداء تُفحَص فقط بعد الإصدار هي بطاقة تقييم، لا ميزانية. الميزانية تُفرَض قبل وقوع الحدث — حدّ حجم لكل مسار يُفشل بناء التكامل المستمر تمامًا كما يفعل خطأ في الأنواع أو اختبار فاشل. معاملة الأداء قيدًا صارمًا، لا مقياسًا يُراجَع لاحقًا، هي ما يمنع صفحة من التثاقل تدريجيًا عبر أشهر من إضافات صغيرة معقولة كل منها على حدة.\n\n## التصيير من جانب الخادم لما يحتاج أن يُعثَر عليه\n\nالمحتوى الذي يحتاج أن يكون قابلًا للزحف والفهرسة يُصيَّر من جانب الخادم، بلا استثناء. لا يزال بإمكان التصيير من جانب العميل تقديم تجربة سريعة للزائر الموجود بالفعل على الصفحة، لكنه لا يقدّم شيئًا لزاحف لا ينفّذ جافاسكربت كما يفعل المتصفح، ويؤخّر أول رسم للزائر الحقيقي الذي يجب أن ينتظر تشغيل نص برمجي قبل رؤية محتوى كان يمكن أن يصل ضمن HTML الأولي.\n\n## إزاحة تخطيط صفرية مسألة أبعاد\n\nإزاحة التخطيط التراكمية هي، في الغالبية الساحقة من الحالات، مسألة بُعد غير محدَّد: صورة أو عنصر مضمَّن دون مساحة محجوزة، فتُعاد الصفحة تخطيطها حين يُحمَّل. تحديد عرض وارتفاع صريحين — أو صندوق نسبة أبعاد — لكل عنصر وسائط يحجز تلك المساحة قبل أن يبدأ أي تنزيل، وهذا وحده كافٍ لإيصال إزاحة التخطيط التراكمية إلى صفر في معظم الصفحات، دون قياس بارع.\n\n## تمييز الشيفرة دون شحن مُمَيِّز\n\nيُصيَّر تمييز صيغة الشيفرة بالكامل من جانب الخادم، فلا تُشحَن أي مكتبة تمييز أو تعريفات قواعد إلى العميل أبدًا. يحصل الزائر على شيفرة مُميَّزة بالكامل ضمن HTML الأولي؛ ولا تحتاج ميزانية جافاسكربت من جانب العميل أبدًا إلى حساب تبعية مهمتها الوحيدة تلوين نص كان ثابتًا أصلًا حين صار الأمر مهمًا.\n\n## لا نص برمجي يدخل افتراضيًا\n\nالنصوص البرمجية من أطراف ثالثة هي الطريقة الأكثر شيوعًا لتجاوز الميزانية دون أن يلمس أحد شيفرة التطبيق — مقطع تحليلات، أو أداة، أو تضمين، كل منها يضيف وزنه وطلباته الخاصة من طرف ثالث. الافتراضي هنا هو صفر نصوص برمجية من أطراف ثالثة؛ وأي إضافة يجب أن تبرّر تكلفتها صراحةً بدل أن تتسلل لأنه كان من السهل لصق وسم نص برمجي.\n\n## الخلاصة\n\nلا شيء من هذه التقنيات غريب — إنها أدوات معيارية تُطبَّق باتساق وتُفرَض آليًا بدل أن تُترَك للنوايا الحسنة. الميزانية لا تعمل إلا إذا كان تجاوزها يُفشل البناء؛ وكل شيء آخر ينتج عن هذا القيد الوحيد.',
      readingTimeMin: 2,
    },
  },
];

// ===== Testimonials =====

interface TestimonialTranslationContent {
  readonly quote: string;
  readonly authorName: string;
  readonly authorRole: string;
}

interface TestimonialSeed {
  readonly order: number;
  readonly en: TestimonialTranslationContent;
  readonly ar: TestimonialTranslationContent;
}

// Demo/placeholder testimonials (HR-8): the owner-profile provides no real recommendations, so these are
// clearly-sample content for local development — quality-focused, grounded in the owner's actual strengths
// (owner-profile §4), with NO fabricated metrics and NO attribution to real employers. Real testimonials
// (e.g. LinkedIn recommendations) are pending owner input before any public promotion.
const TESTIMONIALS: readonly TestimonialSeed[] = [
  {
    order: 0,
    en: {
      quote:
        'Eslam pairs strong frontend architecture with genuine care for performance and accessibility. He thinks in systems, documents his decisions, and raises the bar for everyone around him.',
      authorName: 'Sara Al-Amin',
      authorRole: 'Engineering Manager',
    },
    ar: {
      quote:
        'يجمع إسلام بين معمارية واجهات أمامية متينة واهتمام حقيقي بالأداء وسهولة الوصول. يفكّر بمنطق الأنظمة، ويوثّق قراراته، ويرفع المستوى لكل من حوله.',
      authorName: 'سارة الأمين',
      authorRole: 'مديرة هندسة',
    },
  },
  {
    order: 1,
    en: {
      quote:
        'Working with Eslam is calm and predictable. He turns Figma designs into clean, maintainable interfaces and is clear about the trade-offs behind every decision.',
      authorName: 'Omar Khaled',
      authorRole: 'Product Lead',
    },
    ar: {
      quote:
        'العمل مع إسلام هادئ ويمكن الاعتماد عليه. يحوّل تصاميم Figma إلى واجهات نظيفة قابلة للصيانة، ويوضّح المقايضات خلف كل قرار.',
      authorName: 'عمر خالد',
      authorRole: 'قائد المنتج',
    },
  },
  {
    order: 2,
    en: {
      quote:
        'Everything Eslam ships is clean, documented, and easy to build on. His bilingual, RTL-first work is the most thorough I have reviewed.',
      authorName: 'Layla Hassan',
      authorRole: 'Technical Lead',
    },
    ar: {
      quote:
        'كل ما يسلّمه إسلام نظيف وموثَّق وسهل البناء عليه. وعمله ثنائي اللغة الذي يضع RTL أولًا هو الأكثر إتقانًا مما راجعته.',
      authorName: 'ليلى حسن',
      authorRole: 'قائدة تقنية',
    },
  },
];

// ===== Helpers =====

function mustGet<T>(map: ReadonlyMap<string, T>, key: string, kind: string): T {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`Dev seed: missing ${kind} for key "${key}"`);
  }
  return value;
}

// ===== Ensure functions (idempotent — each guarded by an existence check) =====

async function ensureSkills(): Promise<{
  map: Map<string, string>;
  created: number;
}> {
  const map = new Map<string, string>();
  let created = 0;
  for (const skill of SKILLS) {
    const existing = await prisma.skillTranslation.findFirst({
      where: { locale: LOCALE_EN, label: skill.labelEn },
      select: { skillId: true },
    });
    if (existing) {
      map.set(skill.labelEn, existing.skillId);
      continue;
    }
    const record = await prisma.skill.create({
      data: {
        group: skill.group,
        order: skill.order,
        brandColor: skill.brandColor,
        translations: {
          create: [
            { locale: LOCALE_EN, label: skill.labelEn },
            { locale: LOCALE_AR, label: skill.labelAr },
          ],
        },
      },
      select: { id: true },
    });
    map.set(skill.labelEn, record.id);
    created += 1;
  }
  return { map, created };
}

async function ensureProjects(
  skillMap: ReadonlyMap<string, string>,
): Promise<number> {
  let created = 0;
  for (const project of PROJECTS) {
    const existing = await prisma.projectTranslation.findUnique({
      where: { locale_slug: { locale: LOCALE_EN, slug: project.en.slug } },
      select: { id: true },
    });
    if (existing) {
      continue;
    }
    const skillIds = project.techKeys.map((key) =>
      mustGet(skillMap, key, 'skill'),
    );
    await prisma.project.create({
      data: {
        featured: project.featured,
        isPublished: true,
        order: project.order,
        year: project.year,
        liveUrl: project.liveUrl,
        repoUrl: project.repoUrl,
        translations: {
          create: [
            { locale: LOCALE_EN, ...project.en },
            { locale: LOCALE_AR, ...project.ar },
          ],
        },
        technologies: {
          create: skillIds.map((skillId) => ({ skillId })),
        },
      },
    });
    created += 1;
  }
  return created;
}

async function ensureExperiences(
  skillMap: ReadonlyMap<string, string>,
): Promise<number> {
  let created = 0;
  for (const experience of EXPERIENCES) {
    // No natural unique key; the English role+company pair is unique across the demo set.
    const existing = await prisma.experienceTranslation.findFirst({
      where: {
        locale: LOCALE_EN,
        role: experience.en.role,
        company: experience.en.company,
      },
      select: { id: true },
    });
    if (existing) {
      continue;
    }
    await prisma.experience.create({
      data: {
        startDate: experience.startDate,
        endDate: experience.endDate,
        isCurrent: experience.isCurrent,
        employmentType: experience.employmentType,
        order: experience.order,
        translations: {
          create: [
            { locale: LOCALE_EN, ...experience.en },
            { locale: LOCALE_AR, ...experience.ar },
          ],
        },
        technologies: {
          create: experience.techKeys.map((key) => ({
            skillId: mustGet(skillMap, key, 'skill'),
          })),
        },
      },
    });
    created += 1;
  }
  return created;
}

async function ensureCategories(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const category of CATEGORIES) {
    const existing = await prisma.categoryTranslation.findUnique({
      where: { locale_slug: { locale: LOCALE_EN, slug: category.en.slug } },
      select: { categoryId: true },
    });
    if (existing) {
      map.set(category.en.slug, existing.categoryId);
      continue;
    }
    const record = await prisma.category.create({
      data: {
        translations: {
          create: [
            {
              locale: LOCALE_EN,
              name: category.en.name,
              slug: category.en.slug,
            },
            {
              locale: LOCALE_AR,
              name: category.ar.name,
              slug: category.ar.slug,
            },
          ],
        },
      },
      select: { id: true },
    });
    map.set(category.en.slug, record.id);
  }
  return map;
}

async function ensureTags(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const tag of TAGS) {
    const existing = await prisma.tagTranslation.findUnique({
      where: { locale_slug: { locale: LOCALE_EN, slug: tag.en.slug } },
      select: { tagId: true },
    });
    if (existing) {
      map.set(tag.key, existing.tagId);
      continue;
    }
    const record = await prisma.tag.create({
      data: {
        translations: {
          create: [
            { locale: LOCALE_EN, name: tag.en.name, slug: tag.en.slug },
            { locale: LOCALE_AR, name: tag.ar.name, slug: tag.ar.slug },
          ],
        },
      },
      select: { id: true },
    });
    map.set(tag.key, record.id);
  }
  return map;
}

async function ensureArticles(
  categoryMap: ReadonlyMap<string, string>,
  tagMap: ReadonlyMap<string, string>,
): Promise<number> {
  let created = 0;
  for (const article of ARTICLES) {
    const existing = await prisma.articleTranslation.findUnique({
      where: { locale_slug: { locale: LOCALE_EN, slug: article.en.slug } },
      select: { id: true },
    });
    if (existing) {
      continue;
    }
    const categoryId = mustGet(categoryMap, article.categorySlug, 'category');
    const tagIds = article.tagKeys.map((key) => mustGet(tagMap, key, 'tag'));
    await prisma.article.create({
      data: {
        status: ContentStatus.PUBLISHED,
        publishAt: article.publishAt,
        categoryId,
        translations: {
          create: [
            { locale: LOCALE_EN, ...article.en },
            { locale: LOCALE_AR, ...article.ar },
          ],
        },
        tags: {
          create: tagIds.map((tagId) => ({ tagId })),
        },
      },
    });
    created += 1;
  }
  return created;
}

async function ensureTestimonials(): Promise<number> {
  let created = 0;
  for (const testimonial of TESTIMONIALS) {
    // No natural unique key; the English author name is unique across the demo set.
    const existing = await prisma.testimonialTranslation.findFirst({
      where: { locale: LOCALE_EN, authorName: testimonial.en.authorName },
      select: { id: true },
    });
    if (existing) {
      continue;
    }
    await prisma.testimonial.create({
      data: {
        order: testimonial.order,
        isVisible: true,
        translations: {
          create: [
            { locale: LOCALE_EN, ...testimonial.en },
            { locale: LOCALE_AR, ...testimonial.ar },
          ],
        },
      },
    });
    created += 1;
  }
  return created;
}

// Populate the SiteSettings singleton's profile chrome (social links + availability) so the home hero,
// footer, and contact section render their settings-driven parts. The base seed creates the singleton
// but leaves profileLinks empty; this sets demo values idempotently (overwriting with the same values is
// a no-op in effect). No résumé asset is set (that needs the media pipeline) — the footer résumé link
// simply stays hidden, which is the intended graceful-degradation path. `availabilityStatus` is now
// per-locale (feature 007): its EN/AR values are set on the translation rows below, like tagline.
async function ensureSiteSettingsProfile(): Promise<boolean> {
  const settings = await prisma.siteSettings.findFirst({
    select: { id: true },
  });
  if (!settings) {
    return false;
  }
  // Real owner links (HR-8, owner-profile §8): GitHub grounded in the actual repo host, canonical
  // LinkedIn (R7), canonical contact email (R5 — the "muatemed" spelling is intentional, not a typo).
  // X/Twitter is omitted: the profile lists no handle and one must not be invented.
  await prisma.siteSettings.update({
    where: { id: settings.id },
    data: {
      profileLinks: [
        {
          label: 'GitHub',
          url: 'https://github.com/eslammuatamed',
          icon: 'i-simple-icons-github',
        },
        {
          label: 'LinkedIn',
          url: 'https://www.linkedin.com/in/eslam-muatamed',
          icon: 'i-simple-icons-linkedin',
        },
        {
          label: 'Email',
          url: 'mailto:eslammuatemed@gmail.com',
          icon: 'i-lucide-mail',
        },
      ],
    },
  });

  // Identity translations (HR-8): the base seed sets the tagline but leaves siteName null; set both so
  // the hero renders real identity rather than the i18n brand fallback. `availabilityStatus` is set here
  // per-locale (feature 007) so /ar renders the Arabic value, not the English one. Idempotent upsert on
  // [siteSettingsId, locale]. The About fields carry the same owner-approved copy as the base seed and
  // are set on both branches, so a demo database provisioned by this seed alone is still locale-complete
  // rather than holding a translation row with null About content.
  const identity = [
    {
      locale: 'en',
      siteName: 'Eslam Muatamed',
      tagline: PUBLIC_TAGLINE.en,
      availabilityStatus: 'Open to frontend opportunities',
    },
    {
      locale: 'ar',
      siteName: 'إسلام معتمد',
      tagline: PUBLIC_TAGLINE.ar,
      availabilityStatus: 'متاح لفرص عمل في تطوير الواجهات الأمامية',
    },
  ] as const;
  for (const tr of identity) {
    const about = ABOUT_COPY[tr.locale];
    await prisma.siteSettingsTranslation.upsert({
      where: {
        siteSettingsId_locale: {
          siteSettingsId: settings.id,
          locale: tr.locale,
        },
      },
      update: {
        siteName: tr.siteName,
        tagline: tr.tagline,
        availabilityStatus: tr.availabilityStatus,
        ...about,
      },
      create: {
        siteSettingsId: settings.id,
        locale: tr.locale,
        siteName: tr.siteName,
        tagline: tr.tagline,
        availabilityStatus: tr.availabilityStatus,
        ...about,
      },
    });
  }
  return true;
}

async function main(): Promise<void> {
  const skills = await ensureSkills();
  const projectsCreated = await ensureProjects(skills.map);
  const experiencesCreated = await ensureExperiences(skills.map);
  const categoryMap = await ensureCategories();
  const tagMap = await ensureTags();
  const articlesCreated = await ensureArticles(categoryMap, tagMap);
  const testimonialsCreated = await ensureTestimonials();
  const profileSet = await ensureSiteSettingsProfile();

  console.log(
    'Dev/demo seed complete (idempotent; en + ar translations for every entity):\n' +
      `  Skills:       ${SKILLS.length} total (created ${skills.created})\n` +
      `  Projects:     ${PROJECTS.length} total (created ${projectsCreated}) — ${PROJECTS.filter((p) => p.featured).length} featured, all published\n` +
      `  Experiences:  ${EXPERIENCES.length} total (created ${experiencesCreated})\n` +
      `  Categories:   ${CATEGORIES.length} ensured\n` +
      `  Tags:         ${TAGS.length} ensured\n` +
      `  Articles:     ${ARTICLES.length} total (created ${articlesCreated}) — all PUBLISHED\n` +
      `  Testimonials: ${TESTIMONIALS.length} total (created ${testimonialsCreated}) — all visible\n` +
      `  SiteSettings: profile links + availability ${profileSet ? 'set' : 'skipped (run base seed first)'}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Dev seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
