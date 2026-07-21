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
    liveUrl: 'https://example.com/projects/personal-platform',
    repoUrl: 'https://github.com/example/personal-platform',
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
        '- Full Arabic/English localization with RTL layout mirroring\n- Server-side rendered pages with per-locale meta and canonical URLs\n- Case-study detail pages with a locale-aware slug map\n- Accessible, keyboard-navigable component library\n- Lighthouse performance and SEO scores above 95',
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
    featured: true,
    order: 1,
    year: 2024,
    liveUrl: 'https://example.com/projects/headless-commerce',
    repoUrl: null,
    techKeys: ['Nuxt', 'Vue.js', 'TypeScript', 'Vite'],
    en: {
      title: 'Headless Commerce Storefront',
      slug: 'headless-commerce-storefront',
      summary:
        'A high-performance, headless e-commerce storefront built with Nuxt and a commerce API, focused on Core Web Vitals, faceted search, and a smooth checkout.',
      overview:
        '## Overview\n\nA headless storefront that decouples the shopping experience from the commerce backend, delivering fast product discovery and a resilient cart and checkout.',
      businessProblem:
        'The legacy monolithic storefront was slow to render and hard to iterate on, hurting conversion on mobile.',
      solution:
        'A Nuxt storefront consuming a headless commerce API, with incremental static regeneration for catalog pages, optimistic cart updates, and image optimization.',
      role: 'Lead frontend engineer: architecture, performance, and the checkout flow.',
      architecture:
        'Nuxt (hybrid SSR / ISR), a headless commerce API, and an edge CDN for cached catalog pages.',
      challenges:
        'Balancing freshness and cache hit-rate for pricing and stock, and keeping the cart consistent across tabs and network failures.',
      features:
        '- Faceted, URL-driven product search and filtering\n- Optimistic cart with offline-tolerant syncing\n- Incrementally regenerated catalog pages\n- Responsive, lazy-loaded product imagery\n- Accessible checkout with inline validation',
      lessonsLearned:
        'Treating the cart as an eventually-consistent client store — reconciled against the server — removed a whole class of race conditions.',
      metaTitle: 'Headless Commerce Storefront — Nuxt Case Study',
      metaDescription:
        'A fast, headless Nuxt storefront tuned for Core Web Vitals and mobile conversion.',
    },
    ar: {
      title: 'متجر إلكتروني بواجهة منفصلة',
      slug: 'matjar-headless',
      summary:
        'متجر إلكتروني عالي الأداء بواجهة منفصلة، مبني باستخدام Nuxt وواجهة برمجية للتجارة، مع تركيز على مؤشرات Core Web Vitals والبحث المُصنَّف وتجربة دفع سلسة.',
      overview:
        '## نظرة عامة\n\nمتجر بواجهة منفصلة يفصل تجربة التسوق عن الخادم الخلفي للتجارة، فيقدّم اكتشافًا سريعًا للمنتجات وسلّة وعملية دفع موثوقة.',
      businessProblem:
        'كان المتجر القديم أحادي البنية بطيء التصيير وصعب التطوير، ما أضرّ بمعدل التحويل على الأجهزة المحمولة.',
      solution:
        'متجر Nuxt يستهلك واجهة برمجية للتجارة منفصلة، مع إعادة توليد ثابتة تدريجية لصفحات الكتالوج، وتحديثات تفاؤلية للسلّة، وتحسين للصور.',
      role: 'مهندس الواجهة الأمامية الرئيسي: البنية، والأداء، ومسار الدفع.',
      architecture:
        'Nuxt (تصيير هجين من جانب الخادم مع إعادة توليد ثابتة تدريجية)، وواجهة برمجية للتجارة منفصلة، وشبكة توصيل محتوى طرفية لصفحات الكتالوج المخزَّنة مؤقتًا.',
      challenges:
        'الموازنة بين حداثة الأسعار والمخزون ونسبة الإصابة في التخزين المؤقت، والحفاظ على اتساق السلّة عبر التبويبات وأعطال الشبكة.',
      features:
        '- بحث وتصفية للمنتجات مبنيان على الرابط\n- سلّة تفاؤلية مع مزامنة تتحمّل انقطاع الشبكة\n- صفحات كتالوج تُعاد توليدها تدريجيًا\n- صور منتجات متجاوبة وبتحميل مؤجَّل\n- عملية دفع سهلة الوصول مع تحقق فوري',
      lessonsLearned:
        'معاملة السلّة بوصفها مخزنًا على العميل متسقًا في النهاية — تتم مطابقته مع الخادم — أزالت فئة كاملة من تعارضات التزامن.',
      metaTitle: 'متجر إلكتروني بواجهة منفصلة — دراسة حالة Nuxt',
      metaDescription:
        'متجر Nuxt سريع بواجهة منفصلة، مُحسَّن لمؤشرات Core Web Vitals ومعدل التحويل على الأجهزة المحمولة.',
    },
  },
  {
    featured: true,
    order: 2,
    year: 2024,
    liveUrl: null,
    repoUrl: 'https://github.com/example/realtime-analytics-dashboard',
    techKeys: ['Vue.js', 'Pinia', 'TypeScript', 'Node.js'],
    en: {
      title: 'Real-time Analytics Dashboard',
      slug: 'realtime-analytics-dashboard',
      summary:
        'A real-time analytics dashboard built with Vue 3 and Pinia, streaming live metrics over WebSockets with virtualized tables and interactive charts.',
      overview:
        '## Overview\n\nAn operational dashboard that visualizes live business metrics, with sub-second updates, drill-down charts, and a responsive grid of configurable widgets.',
      businessProblem:
        'Operators needed a single live view of key metrics instead of polling several disconnected tools.',
      solution:
        'A Vue 3 SPA with a Pinia store fed by a WebSocket stream, virtualized data grids, and canvas-based charts for smooth rendering at high update rates.',
      role: 'Frontend engineer: state architecture, the real-time data layer, and data-visualization performance.',
      architecture:
        'Vue 3 + Pinia on the client, a WebSocket gateway for streaming, and a Node.js aggregation service.',
      challenges:
        'Rendering thousands of updating rows without dropping frames, and keeping the store’s memory bounded under a continuous stream.',
      features:
        '- Sub-second live metric updates over WebSockets\n- Virtualized tables handling tens of thousands of rows\n- Configurable, draggable widget grid\n- Interactive, drill-down charts\n- Automatic reconnection with backfill',
      lessonsLearned:
        'Decoupling the transport stream from the render loop — batching updates per animation frame — was the key to a smooth 60fps under load.',
      metaTitle: 'Real-time Analytics Dashboard — Vue 3 Case Study',
      metaDescription:
        'A Vue 3 + Pinia dashboard streaming live metrics over WebSockets at 60fps.',
    },
    ar: {
      title: 'لوحة تحليلات فورية',
      slug: 'lawhat-tahlilat-fawriya',
      summary:
        'لوحة تحليلات فورية مبنية باستخدام Vue 3 و Pinia، تبثّ مؤشرات حيّة عبر WebSockets مع جداول مُحاكاة افتراضيًا ومخططات تفاعلية.',
      overview:
        '## نظرة عامة\n\nلوحة تشغيلية تعرض مؤشرات الأعمال الحيّة، بتحديثات دون الثانية، ومخططات قابلة للتعمّق، وشبكة متجاوبة من عناصر قابلة للتهيئة.',
      businessProblem:
        'احتاج المشغّلون إلى عرض حيّ موحّد للمؤشرات الرئيسية بدلًا من الاستعلام المتكرر من أدوات متفرقة.',
      solution:
        'تطبيق أحادي الصفحة بـ Vue 3 مع مخزن Pinia يُغذّى من تدفق WebSocket، وجداول بيانات مُحاكاة افتراضيًا، ومخططات مبنية على Canvas لتصيير سلس عند معدلات تحديث عالية.',
      role: 'مهندس واجهة أمامية: بنية الحالة، وطبقة البيانات الفورية، وأداء تمثيل البيانات.',
      architecture:
        'Vue 3 و Pinia على العميل، وبوابة WebSocket للبث، وخدمة تجميع مبنية على Node.js.',
      challenges:
        'تصيير آلاف الصفوف المتحدّثة دون فقدان الإطارات، والحفاظ على حدود ذاكرة المخزن تحت تدفق مستمر.',
      features:
        '- تحديثات حيّة دون الثانية عبر WebSockets\n- جداول مُحاكاة افتراضيًا تتعامل مع عشرات الآلاف من الصفوف\n- شبكة عناصر قابلة للتهيئة والسحب\n- مخططات تفاعلية قابلة للتعمّق\n- إعادة اتصال تلقائية مع تعويض البيانات الفائتة',
      lessonsLearned:
        'فصل تدفق النقل عن حلقة التصيير — بتجميع التحديثات لكل إطار رسم — كان مفتاح الحصول على 60 إطارًا في الثانية بسلاسة تحت الحِمل.',
      metaTitle: 'لوحة تحليلات فورية — دراسة حالة Vue 3',
      metaDescription:
        'لوحة مبنية على Vue 3 و Pinia تبثّ مؤشرات حيّة عبر WebSockets بمعدل 60 إطارًا في الثانية.',
    },
  },
  {
    featured: false,
    order: 3,
    year: 2023,
    liveUrl: null,
    repoUrl: 'https://github.com/example/bilingual-design-system',
    techKeys: ['Vue.js', 'TypeScript', 'Tailwind CSS'],
    en: {
      title: 'Bilingual Design System & Component Library',
      slug: 'bilingual-design-system',
      summary:
        'A themeable, accessible Vue component library and design system with first-class RTL support, design tokens, and automated documentation.',
      overview:
        '## Overview\n\nA shared design system that unifies UI across products, with design tokens, accessible components, and living documentation generated from source.',
      businessProblem:
        'Teams were duplicating inconsistent components, causing visual drift and accessibility regressions.',
      solution:
        'A Vue + TypeScript library driven by design tokens, tested for accessibility, documented with interactive examples, and shipped as a versioned package.',
      role: 'Design-systems engineer: token architecture, component API design, and accessibility.',
      architecture:
        'Vue 3 + TypeScript components, Tailwind-based tokens, and an automated documentation site.',
      challenges:
        'Designing a token layer that expresses both light/dark themes and LTR/RTL without conditional component code.',
      features:
        '- Design tokens for color, spacing, and typography\n- RTL-aware components with no per-direction forks\n- Automated accessibility tests in CI\n- Interactive, versioned documentation\n- Tree-shakeable, typed package exports',
      lessonsLearned:
        'Encoding direction and theme as tokens — not component branches — kept the API stable while the visual layer evolved.',
      metaTitle: 'Bilingual Design System & Component Library — Vue Case Study',
      metaDescription:
        'An accessible, RTL-first Vue design system driven by design tokens.',
    },
    ar: {
      title: 'نظام تصميم ومكتبة مكوّنات ثنائية اللغة',
      slug: 'nizam-tasmim-thunai-allugha',
      summary:
        'مكتبة مكوّنات Vue ونظام تصميم قابلان للتنسيق وسهلا الوصول، مع دعم أصيل للاتجاه من اليمين إلى اليسار، ورموز تصميم، وتوثيق آلي.',
      overview:
        '## نظرة عامة\n\nنظام تصميم مشترك يوحّد واجهات المنتجات، مع رموز تصميم، ومكوّنات سهلة الوصول، وتوثيق حيّ مُولَّد من الشيفرة المصدرية.',
      businessProblem:
        'كانت الفرق تكرّر مكوّنات غير متسقة، ما تسبّب في انحراف بصري وتراجع في سهولة الوصول.',
      solution:
        'مكتبة مبنية على Vue و TypeScript تقودها رموز التصميم، ومختبرة لسهولة الوصول، وموثَّقة بأمثلة تفاعلية، وتُوزَّع بوصفها حزمة مُصدَّرة بإصدارات.',
      role: 'مهندس أنظمة تصميم: بنية الرموز، وتصميم واجهات المكوّنات، وسهولة الوصول.',
      architecture:
        'مكوّنات Vue 3 و TypeScript، ورموز مبنية على Tailwind، وموقع توثيق آلي.',
      challenges:
        'تصميم طبقة رموز تعبّر عن السمتين الفاتحة والداكنة والاتجاهين من اليسار واليمين دون شيفرة مكوّنات شرطية.',
      features:
        '- رموز تصميم للألوان والتباعد وأنماط الخطوط\n- مكوّنات تراعي الاتجاه من اليمين إلى اليسار دون تفريعات لكل اتجاه\n- اختبارات آلية لسهولة الوصول ضمن التكامل المستمر\n- توثيق تفاعلي بإصدارات\n- صادرات حزمة مُوَّعة الأنواع وقابلة لهزّ الشجرة',
      lessonsLearned:
        'ترميز الاتجاه والسمة بوصفهما رموزًا — لا تفريعات في المكوّنات — أبقى الواجهة البرمجية مستقرة بينما تطوّرت الطبقة البصرية.',
      metaTitle: 'نظام تصميم ومكتبة مكوّنات ثنائية اللغة — دراسة حالة Vue',
      metaDescription:
        'نظام تصميم Vue سهل الوصول ويراعي الاتجاه من اليمين إلى اليسار، تقوده رموز التصميم.',
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
}

const EXPERIENCES: readonly ExperienceSeed[] = [
  {
    startDate: new Date('2024-01-01T00:00:00.000Z'),
    endDate: null,
    isCurrent: true,
    employmentType: EmploymentType.FULL_TIME,
    order: 0,
    en: {
      role: 'Senior Frontend Engineer',
      company: 'Nimbus Digital',
      location: 'Cairo, Egypt (Remote)',
      impact:
        '- Led the migration of a legacy Vue 2 app to Nuxt 4, cutting Largest Contentful Paint by 45%\n- Established the team’s i18n and RTL standards and shipped full Arabic support\n- Mentored three engineers and introduced a component-testing culture',
    },
    ar: {
      role: 'مهندس واجهات أمامية أول',
      company: 'Nimbus Digital',
      location: 'القاهرة، مصر (عن بُعد)',
      impact:
        '- قُدت ترحيل تطبيق قديم من Vue 2 إلى Nuxt 4، ما خفّض زمن أكبر عنصر مُصيَّر بنسبة 45%\n- أرسيت معايير الفريق للتعريب والاتجاه من اليمين إلى اليسار، وأطلقت دعمًا كاملًا للعربية\n- أرشدت ثلاثة مهندسين وأدخلت ثقافة اختبار المكوّنات',
    },
  },
  {
    startDate: new Date('2022-06-01T00:00:00.000Z'),
    endDate: new Date('2023-12-31T00:00:00.000Z'),
    isCurrent: false,
    employmentType: EmploymentType.CONTRACT,
    order: 1,
    en: {
      role: 'Frontend Engineer',
      company: 'Bloom Commerce',
      location: 'Remote',
      impact:
        '- Built a headless storefront in Nuxt that improved mobile conversion by 18%\n- Reduced the JavaScript bundle size by 32% through code-splitting and lazy loading\n- Integrated a typed API client generated from the backend contract',
    },
    ar: {
      role: 'مهندس واجهات أمامية',
      company: 'Bloom Commerce',
      location: 'عن بُعد',
      impact:
        '- بنيت متجرًا بواجهة منفصلة باستخدام Nuxt رفع معدل التحويل على الأجهزة المحمولة بنسبة 18%\n- خفّضت حجم حزمة جافاسكربت بنسبة 32% عبر تقسيم الشيفرة والتحميل المؤجَّل\n- دمجت عميل واجهة برمجية مُولَّدًا من عقد الخادم',
    },
  },
  {
    startDate: new Date('2021-01-01T00:00:00.000Z'),
    endDate: new Date('2022-05-31T00:00:00.000Z'),
    isCurrent: false,
    employmentType: EmploymentType.FREELANCE,
    order: 2,
    en: {
      role: 'Frontend Developer',
      company: 'Independent / Freelance',
      location: 'Remote',
      impact:
        '- Delivered a dozen responsive marketing sites for regional clients\n- Standardized an accessible, reusable Vue component kit across projects\n- Improved average Lighthouse performance scores from the 60s to above 90',
    },
    ar: {
      role: 'مطوّر واجهات أمامية',
      company: 'عمل حر مستقل',
      location: 'عن بُعد',
      impact:
        '- سلّمت اثني عشر موقعًا تسويقيًا متجاوبًا لعملاء إقليميين\n- وحّدت طقم مكوّنات Vue قابلًا لإعادة الاستخدام وسهل الوصول عبر المشاريع\n- رفعت متوسط درجات الأداء في Lighthouse من الستينيات إلى ما فوق 90',
    },
  },
  {
    startDate: new Date('2019-09-01T00:00:00.000Z'),
    endDate: new Date('2020-12-31T00:00:00.000Z'),
    isCurrent: false,
    employmentType: EmploymentType.FULL_TIME,
    order: 3,
    en: {
      role: 'Junior Frontend Developer',
      company: 'Startup Studio',
      location: 'Cairo, Egypt',
      impact:
        '- Implemented UI features across several early-stage products\n- Learned modern JavaScript, Vue, and component-driven development\n- Contributed to the team’s first shared style guide',
    },
    ar: {
      role: 'مطوّر واجهات أمامية مبتدئ',
      company: 'Startup Studio',
      location: 'القاهرة، مصر',
      impact:
        '- نفّذت ميزات واجهة عبر عدة منتجات في مراحلها المبكرة\n- تعلّمت جافاسكربت الحديثة و Vue والتطوير المبني على المكوّنات\n- ساهمت في أول دليل أنماط مشترك للفريق',
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

const TESTIMONIALS: readonly TestimonialSeed[] = [
  {
    order: 0,
    en: {
      quote:
        'Eslam turned a sluggish legacy app into a fast, fully bilingual product. His grasp of Nuxt, performance, and accessibility raised the bar for the whole team.',
      authorName: 'Sara Al-Amin',
      authorRole: 'Engineering Manager, Nimbus Digital',
    },
    ar: {
      quote:
        'حوّل إسلام تطبيقًا قديمًا بطيئًا إلى منتج سريع وثنائي اللغة بالكامل. فهمه لـ Nuxt والأداء وسهولة الوصول رفع مستوى الفريق بأكمله.',
      authorName: 'سارة الأمين',
      authorRole: 'مديرة هندسة، Nimbus Digital',
    },
  },
  {
    order: 1,
    en: {
      quote:
        'The headless storefront he built measurably improved our mobile conversion. Eslam is meticulous about performance and a pleasure to collaborate with.',
      authorName: 'Omar Khaled',
      authorRole: 'Product Lead, Bloom Commerce',
    },
    ar: {
      quote:
        'المتجر بالواجهة المنفصلة الذي بناه حسّن معدل التحويل على الأجهزة المحمولة بشكل ملموس. إسلام دقيق في الأداء وممتع في التعاون.',
      authorName: 'عمر خالد',
      authorRole: 'قائد المنتج، Bloom Commerce',
    },
  },
  {
    order: 2,
    en: {
      quote:
        'Eslam designed our component library and set our accessibility standards. Everything he ships is clean, documented, and easy to build on.',
      authorName: 'Layla Hassan',
      authorRole: 'CTO, Startup Studio',
    },
    ar: {
      quote:
        'صمّم إسلام مكتبة المكوّنات لدينا ووضع معايير سهولة الوصول. كل ما يسلّمه نظيف وموثَّق وسهل البناء عليه.',
      authorName: 'ليلى حسن',
      authorRole: 'المديرة التقنية، Startup Studio',
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

async function ensureExperiences(): Promise<number> {
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
// simply stays hidden, which is the intended graceful-degradation path. `availabilityStatus` is a single
// scalar in the contract (not per-locale), so the same string shows in both locales — a demo limitation.
async function ensureSiteSettingsProfile(): Promise<boolean> {
  const settings = await prisma.siteSettings.findFirst({
    select: { id: true },
  });
  if (!settings) {
    return false;
  }
  await prisma.siteSettings.update({
    where: { id: settings.id },
    data: {
      availabilityStatus: 'Open to senior frontend roles',
      profileLinks: [
        {
          label: 'GitHub',
          url: 'https://github.com/example',
          icon: 'i-simple-icons-github',
        },
        {
          label: 'LinkedIn',
          url: 'https://www.linkedin.com/in/example',
          icon: 'i-simple-icons-linkedin',
        },
        { label: 'X', url: 'https://x.com/example', icon: 'i-simple-icons-x' },
        {
          label: 'Email',
          url: 'mailto:hello@example.com',
          icon: 'i-lucide-mail',
        },
      ],
    },
  });
  return true;
}

async function main(): Promise<void> {
  const skills = await ensureSkills();
  const projectsCreated = await ensureProjects(skills.map);
  const experiencesCreated = await ensureExperiences();
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
