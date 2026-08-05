// Canonical Projects (doc 09 §6.1). Natural key: the ENGLISH `ProjectTranslation.slug`.
// Pure data — no database calls.

export interface ProjectTranslationContent {
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

export interface ProjectSeed {
  readonly featured: boolean;
  readonly order: number;
  readonly year: number;
  readonly liveUrl: string | null;
  readonly repoUrl: string | null;
  readonly techKeys: readonly string[]; // Skill.slug of seeded skills (3-5, unique per project)
  readonly en: ProjectTranslationContent;
  readonly ar: ProjectTranslationContent;
}

export const PROJECTS: readonly ProjectSeed[] = [
  {
    featured: true,
    order: 0,
    year: 2025,
    // Not yet publicly deployed (Release Freeze); repos are not linked here. No placeholder URLs (HR-9).
    liveUrl: null,
    repoUrl: null,
    techKeys: ['nuxt', 'vue', 'typescript', 'tailwind-css', 'nestjs'],
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
    // `year` is 2026, not the 2025 this dataset previously carried and production still serves. The
    // wrong value survived because the seed was create-only: it wrote the year once, at first
    // provisioning, and never spoke about that row again. Correcting it HERE rather than by a one-off
    // UPDATE is the point of the canonical dataset — the fix is reviewable as a diff and is re-asserted
    // on every synchronization, so it cannot silently drift back (doc 09 §6.1).
    featured: true,
    order: 1,
    year: 2026,
    liveUrl: null,
    repoUrl: null,
    techKeys: ['nuxt', 'vue', 'typescript', 'nestjs', 'tailwind-css'],
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
    techKeys: ['nuxt', 'vue', 'typescript', 'tailwind-css'],
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
    techKeys: ['vue', 'typescript', 'tailwind-css'],
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
