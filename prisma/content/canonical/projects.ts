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
  /**
   * The project's public URL, and ONLY where its governed case-study notes in
   * `eslammuatamed-docs/content/projects/<id>/case-study-notes.json` record
   * `publication.publicUrlAllowed: true`. Taken verbatim from that source's `projectOverview.publicUrl`
   * — never reconstructed from a project name, never guessed from a domain pattern.
   */
  readonly liveUrl: string | null;
  /**
   * Always `null`, and this is a governance outcome rather than missing data: every case-study source
   * lists "Private repository details" under `avoidPublishingWithoutReview`. FR-PUB-033 handles the
   * absence gracefully by design, so a project with no repository link is a complete project.
   */
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
    // THIS project (the platform you are reading) is not yet publicly launched, so it has no live URL
    // to publish. A placeholder is never invented — the same no-invention rule D18-7 applies to a
    // fabricated MediaAsset. Its three siblings below DO carry live URLs; see the note on `repoUrl`
    // in `ProjectSeed` for why no project publishes a repository link.
    liveUrl: null,
    repoUrl: null,
    techKeys: ['nuxt', 'vue', 'typescript', 'tailwind-css', 'nestjs'],
    en: {
      title: 'Personal Platform & Portfolio',
      slug: 'personal-platform',
      summary:
        'A bilingual, SEO-first personal platform and portfolio built with Nuxt — server-side rendered, fully localized in Arabic and English with RTL support, and backed by a headless NestJS API.',
      overview:
        'A production-grade personal platform that presents case studies, articles, and a professional profile in both Arabic and English. The site is server-rendered for performance and search visibility, and consumes a decoupled REST API.',
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
        'منصة شخصية بمستوى إنتاجي تعرض دراسات الحالة والمقالات والملف المهني بالعربية والإنجليزية معًا. يُصيَّر الموقع من جانب الخادم لتحقيق أداء أعلى وظهور أفضل في نتائج البحث، ويستهلك واجهة برمجية REST منفصلة.',
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
    liveUrl: 'https://www.samtinstitution.com',
    repoUrl: null,
    techKeys: ['nuxt', 'vue', 'typescript', 'nestjs', 'tailwind-css'],
    en: {
      title: 'SAMT — Institution Website & CMS',
      slug: 'samt-institution-website',
      summary:
        'An institution website with a custom admin dashboard and CMS, built from scratch — a Nuxt frontend, a NestJS backend, and management of content, blog articles, SEO settings, and contact submissions, with a strong SEO and performance focus.',
      overview:
        'A complete institution website and content platform built end to end: a server-rendered Nuxt frontend and a NestJS backend, with an admin dashboard for managing content, blog articles, SEO settings, and contact submissions.',
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
        'موقع مؤسسة ومنصّة محتوى متكاملان بُنيا من البداية إلى النهاية: واجهة أمامية بـ Nuxt مُصيَّرة من جانب الخادم وخادم بـ NestJS، مع لوحة تحكّم لإدارة المحتوى ومقالات المدوّنة وإعدادات تحسين محركات البحث ورسائل التواصل.',
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
    liveUrl: 'https://lurestores.com',
    repoUrl: null,
    techKeys: ['nuxt', 'vue', 'typescript', 'tailwind-css'],
    en: {
      title: 'Lure Stores — Multi-vendor Commerce',
      slug: 'lure-stores-multivendor-commerce',
      summary:
        'A multi-vendor e-commerce platform built in Nuxt — the customer storefront, the vendor dashboard, and the admin dashboard — integrated with a REST API.',
      overview:
        'A multi-vendor commerce platform with three surfaces: a customer storefront, a vendor dashboard for managing catalog and orders, and an admin dashboard — all built in Nuxt against a REST API.',
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
        'منصّة تجارة متعدّدة البائعين بثلاثة أسطح: واجهة متجر للعملاء، ولوحة تحكّم للبائعين لإدارة الكتالوج والطلبات، ولوحة تحكّم للإدارة — جميعها مبنية بـ Nuxt أمام واجهة برمجية REST.',
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
    liveUrl: 'https://gowavex.com',
    repoUrl: null,
    techKeys: ['vue', 'typescript', 'tailwind-css'],
    en: {
      title: 'WaveX — Multi-portal Logistics Platform',
      slug: 'wavex-logistics-platform',
      summary:
        'A multi-portal logistics platform covering the shipping lifecycle — administrators, merchants, intercity operators, drivers, and last-mile partners — with a Vue frontend on an Inertia.js + Laravel stack.',
      overview:
        'A logistics platform spanning the shipping lifecycle across several portals — administrators, merchants, intercity operators, drivers, and last-mile partners — built with Vue and Inertia.js on a Laravel backend.',
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
        'منصّة لوجستية تغطّي دورة حياة الشحن عبر عدّة بوّابات — المديرين والتجّار ومشغّلي النقل بين المدن والسائقين وشركاء التوصيل الأخير — مبنية بـ Vue و Inertia.js على خلفية Laravel.',
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
  {
    // Zidni — an existing live e-learning SaaS Eslam JOINED as its sole FRONTEND developer
    // (case-study notes `zidni`, team size 3). The wording constraints are load-bearing: he did not
    // build the original platform, he was not the only developer on the product, and the later UI/UX
    // references are the designer's. What is his: ongoing frontend ownership, the live-session module,
    // course packaging, the Tailwind migration and the portal work.
    featured: false,
    order: 4,
    year: 2025,
    liveUrl: 'https://www.zidni.cloud',
    repoUrl: null,
    techKeys: ['vue', 'typescript', 'javascript', 'pinia', 'tailwind-css'],
    en: {
      title: 'Zidni — E-learning Platform',
      slug: 'zidni-elearning-platform',
      summary:
        'Sole frontend developer on a live e-learning SaaS supporting recorded courses, digital books, live courses and individual live lessons — delivering new capabilities and modernizing the platform while it stayed in production.',
      overview:
        'A production e-learning platform for learners, instructors and administrators, covering recorded courses, digital books, live courses and individual live lessons. I joined it while it was already running and became its sole frontend developer, responsible for ongoing implementation, modernization and production issue resolution across its portals.',
      businessProblem:
        'The platform was live and actively evolving but had no other active frontend developer. It needed new learning and live-session capabilities, more flexible ways to sell courses, and a frontend that could keep being changed safely — all without interrupting the product people were already using.',
      solution:
        'I delivered new features inside the existing codebase rather than around it: a live-session module with recurring sessions at regular intervals, calendar-based viewing of session dates and times, course-level configuration for selling a whole course or separate units, and assignments linked to lessons inside units. Alongside the features I refactored the frontend and migrated its styling from accumulated CSS to Tailwind CSS.',
      role: 'Frontend Developer and sole frontend engineer on a three-person team, alongside a backend developer and a UI/UX designer. I owned frontend development across the platform’s portals, integrated new features with the REST APIs, and made early interface improvements myself before dedicated design references became available — implementing and aligning with the designer’s references once they did.',
      architecture:
        'A Vue.js frontend with Pinia for state and Tailwind CSS for styling, consuming REST APIs, with a calendar library for session scheduling views. One architectural boundary is worth naming: the public marketing experience was moved out into a separate application, because a marketing site and an authenticated learning product have different rendering and SEO priorities. That separate site is its own case study.',
      challenges:
        'Modernizing an active production codebase meant controlled evolution rather than a rewrite — changes went in incrementally while shared areas were refactored and existing workflows preserved. Instructor landing pages carried responsive and data-display faults caused by overlapping CSS; I separated the conflicting style responsibilities and removed the overlap before continuing the migration. Recurring live sessions and flexible course packaging both had to be modelled explicitly rather than handled as conditions in the interface.',
      features:
        '- Recorded courses, digital books, live courses and individual live lessons\n- Live-session scheduling with recurring sessions at regular intervals\n- Calendar-based viewing of session dates and times\n- Courses sold complete or divided into separately purchasable units\n- Assignments linked to lessons inside units\n- Learner, instructor and administration portals\n- Styling migrated from accumulated CSS to Tailwind CSS',
      lessonsLearned:
        'Loosely scoped styles create invisible coupling, and it becomes expensive precisely where a product has many portals sharing one stylesheet. The other lesson was about commercial rules: whether a course sells whole or by the unit reshapes the content model, so it belongs in the model rather than in UI conditionals.',
      metaTitle: 'Zidni — E-learning Platform Case Study',
      metaDescription:
        'Sole frontend developer on a live e-learning SaaS: live sessions, recurring schedules, flexible course packaging and a Tailwind CSS migration.',
    },
    ar: {
      title: 'زدني — منصّة تعليم إلكتروني',
      slug: 'zidni-mansat-taalim-elektroni',
      summary:
        'المطوّر الأمامي الوحيد في منصّة تعليم إلكتروني قائمة بالفعل، تدعم الدورات المسجّلة والكتب الرقمية والدورات والدروس المباشرة — مع إضافة قدرات جديدة وتحديث المنصّة وهي في الإنتاج.',
      overview:
        'منصّة تعليم إلكتروني في الإنتاج تخدم المتعلّمين والمدرّبين والمشرفين، وتغطّي الدورات المسجّلة والكتب الرقمية والدورات المباشرة والدروس المباشرة الفردية. انضممتُ إليها وهي تعمل بالفعل، وأصبحتُ مطوّرها الأمامي الوحيد، مسؤولًا عن التطوير المستمر والتحديث ومعالجة مشكلات الإنتاج في بوّاباتها.',
      businessProblem:
        'كانت المنصّة تعمل وتتطوّر باستمرار، لكن لم يكن فيها مطوّر أمامي آخر نشِط. احتاجت إلى قدرات جديدة للتعلّم والجلسات المباشرة، وطرق أكثر مرونة لبيع الدورات، وواجهة أمامية يمكن تعديلها بأمان — دون أي انقطاع للمستخدمين الذين يعتمدون عليها فعلًا.',
      solution:
        'أضفتُ الميزات داخل الكود القائم لا حوله: وحدة للجلسات المباشرة تدعم التكرار على فترات منتظمة، وعرضًا تقويميًا لمواعيد الجلسات وأوقاتها، وإعدادًا على مستوى الدورة يتيح بيعها كاملةً أو مقسّمةً إلى وحدات تُشترى منفصلة، وواجبات مرتبطة بالدروس داخل الوحدات. وبالتوازي مع الميزات، أعدتُ هيكلة الواجهة الأمامية ونقلتُ تنسيقاتها من CSS متراكم إلى Tailwind CSS.',
      role: 'مطوّر واجهات أمامية، والمهندس الأمامي الوحيد في فريق من ثلاثة أفراد، إلى جانب مطوّر خلفية ومصمّم تجربة وواجهة. تولّيتُ تطوير الواجهة الأمامية في بوّابات المنصّة، وربطتُ الميزات الجديدة بواجهات REST، وأجريتُ تحسينات مبكّرة على الواجهة بنفسي قبل توفّر مراجع تصميم مخصّصة — ثم نفّذتُ مراجع المصمّم والتزمتُ بها بعد توفّرها.',
      architecture:
        'واجهة أمامية بـ Vue.js مع Pinia لإدارة الحالة و Tailwind CSS للتنسيق، تستهلك واجهات REST، مع مكتبة تقويم لعروض مواعيد الجلسات. وثمّة حدٌّ معماري يستحقّ الذكر: نُقلت التجربة التعريفية العامة إلى تطبيق منفصل، لأنّ الموقع التعريفي والمنتج التعليمي المُوثَّق يختلفان في أولويات التصيير وتحسين محركات البحث. ذلك الموقع المنفصل دراسة حالة مستقلّة بذاتها.',
      challenges:
        'تحديث كود إنتاجي نشِط يعني تطويرًا محكومًا لا إعادة كتابة — كانت التغييرات تدخل تدريجيًا مع إعادة هيكلة المناطق المشتركة والحفاظ على المسارات القائمة. وكانت صفحات هبوط المدرّبين تعاني مشكلات في الاستجابة وعرض البيانات سببها تعارض تنسيقات CSS؛ ففصلتُ مسؤوليات التنسيق المتضاربة وأزلتُ التداخل قبل متابعة النقل. أمّا الجلسات المتكرّرة ومرونة تقسيم الدورات فكان لا بدّ من تمثيلهما صراحةً في النموذج، لا التعامل معهما كشروط في الواجهة.',
      features:
        '- دورات مسجّلة وكتب رقمية ودورات مباشرة ودروس مباشرة فردية\n- جدولة الجلسات المباشرة مع تكرارها على فترات منتظمة\n- عرض تقويمي لمواعيد الجلسات وأوقاتها\n- بيع الدورات كاملةً أو مقسّمةً إلى وحدات تُشترى منفصلة\n- واجبات مرتبطة بالدروس داخل الوحدات\n- بوّابات للمتعلّمين والمدرّبين والإدارة\n- نقل التنسيقات من CSS متراكم إلى Tailwind CSS',
      lessonsLearned:
        'التنسيقات ضعيفة النطاق تُنشئ ترابطًا خفيًّا، وتصبح مكلفة تحديدًا حيث تتشارك بوّابات كثيرة ورقة أنماط واحدة. والدرس الآخر يتعلّق بالقواعد التجارية: كون الدورة تُباع كاملةً أو بالوحدة يعيد تشكيل نموذج المحتوى، فموضعه النموذج لا شروط الواجهة.',
      metaTitle: 'زدني — دراسة حالة منصّة تعليم إلكتروني',
      metaDescription:
        'المطوّر الأمامي الوحيد في منصّة تعليم إلكتروني قائمة: جلسات مباشرة وجداول متكرّرة ومرونة في تقسيم الدورات ونقل إلى Tailwind CSS.',
    },
  },
  {
    // Zidni AI — a DISTINCT project from the Zidni SaaS above, deliberately so (its own case-study
    // notes make the separation a recorded decision). Built from scratch. Two constraints matter: the
    // visual design was PROVIDED (he participated extensively in product/interface decisions but did
    // not create it), and the product is PRE-LAUNCH — `launchWording` in the source forbids calling it
    // live until launch is confirmed. The reused SAMT work is described as adapted modules, never as a
    // shared package or monorepo, which the source also forbids without separate confirmation.
    featured: false,
    order: 5,
    year: 2026,
    liveUrl: 'https://zidniai.com',
    repoUrl: null,
    techKeys: ['nuxt', 'nestjs', 'prisma', 'typescript', 'technical-seo'],
    en: {
      title: 'Zidni AI — Public Website & CMS',
      slug: 'zidni-ai-website-cms',
      summary:
        'A bilingual, server-rendered product website and custom CMS built from scratch with Nuxt and NestJS — dynamic pricing-plan management, SEO controls and contact handling, adapting proven modules from an earlier project.',
      overview:
        'A bilingual Arabic and English public website and custom content-management system presenting the Zidni AI product, its capabilities, pricing plans, company information and contact channels. It is a separate project from the Zidni learning platform: same product family, different architectural concerns. The product was in its final pre-launch stage when this case study was written.',
      businessProblem:
        'The product needed a public presence that could rank and read well in two languages, and an administration surface where pricing and commercial content could change without a deployment. It also needed to be built quickly, without re-solving problems that had already been solved for an earlier product.',
      solution:
        'I built the public site server-rendered in both locales, and a custom dashboard behind it. The line I drew was between stable and operational content: product-feature explanations stay static in the frontend, closely tied to the design, while pricing plans and their nested features are fully dashboard-managed — bilingual, with icon selection, activation and deactivation, featured highlighting, and ordering for both plans and the features inside them. One slug-based route renders every feature-detail page from structured static content instead of duplicating a layout per feature.',
      role: 'Full-Stack Developer. I built the project from scratch — the bilingual server-rendered site, the administration dashboard, dynamic pricing-plan and plan-feature management, contact-submission handling, and global and page-level SEO management. The visual design was provided by a UI/UX designer, and I participated extensively with them in product and interface decisions. I adapted the SAMT dashboard foundation and bounded backend modules such as authentication rather than rebuilding equivalents.',
      architecture:
        'Nuxt on the frontend with server-side rendering for the public pages, a NestJS backend exposing REST APIs, and Prisma over SQLite for data. Architecture and modules were adapted from the earlier SAMT project — reuse at the module level, reviewed and fitted to this product’s context rather than copied blindly.',
      challenges:
        'The hardest question was not technical but editorial: deciding what should be configurable at all. The project held both stable product explanations and content that changes on its own schedule, so configurability followed real publishing need rather than being applied everywhere. Bilingual nested content brought its own problem — plans and the features inside them each needed Arabic and English text, icons, ordering, status and featured state, which only stays manageable with explicit ownership and ordering rules.',
      features:
        '- Bilingual Arabic and English server-rendered public pages\n- Dynamic pricing plans with bilingual nested features\n- Icon selection, activation state and featured highlighting per plan\n- Ordering controls for plans and for features within a plan\n- One slug-based feature-detail route driven by structured static content\n- Contact-submission management\n- Global and page-level SEO management',
      lessonsLearned:
        'Configurability has a maintenance cost, so it should follow how often something actually changes rather than being granted by default. And different URLs do not require different implementations — one content-driven route served every feature page without duplicating its layout or behaviour.',
      metaTitle: 'Zidni AI — Public Website & CMS Case Study',
      metaDescription:
        'A bilingual SSR product website and custom CMS in Nuxt and NestJS, with dashboard-managed pricing plans, SEO controls and adapted modules.',
    },
    ar: {
      title: 'زدني AI — الموقع العام ونظام إدارة المحتوى',
      slug: 'zidni-ai-mawqi-wa-nizam-idara',
      summary:
        'موقع منتج ثنائي اللغة مُصيَّر من جانب الخادم ونظام إدارة محتوى مخصّص، بُنيا من الصفر بـ Nuxt و NestJS — إدارة ديناميكية لخطط الأسعار وأدوات لتحسين محركات البحث ومعالجة للرسائل، مع تكييف وحدات مُثبتة من مشروع سابق.',
      overview:
        'موقع عام ثنائي اللغة بالعربية والإنجليزية ونظام إدارة محتوى مخصّص، يعرّفان بمنتج زدني AI وقدراته وخطط أسعاره ومعلومات الشركة وقنوات التواصل. وهو مشروع منفصل عن منصّة زدني التعليمية: العائلة نفسها، لكن الاهتمامات المعمارية مختلفة. كان المنتج في مرحلته النهائية قبل الإطلاق وقت كتابة دراسة الحالة هذه.',
      businessProblem:
        'احتاج المنتج إلى حضور عام يقرأ جيدًا ويظهر جيدًا في نتائج البحث بلغتين، وإلى سطح إداري يتيح تغيير الأسعار والمحتوى التجاري دون نشر جديد. واحتاج أيضًا إلى بناء سريع، دون إعادة حلّ مسائل سبق حلّها في منتج أسبق.',
      solution:
        'بنيتُ الموقع العام مُصيَّرًا من جانب الخادم باللغتين، ولوحة تحكّم مخصّصة خلفه. والخطّ الذي رسمتُه كان بين المحتوى المستقرّ والمحتوى التشغيلي: شروح ميزات المنتج تبقى ثابتة في المشروع الأمامي، مرتبطةً بالتصميم ارتباطًا وثيقًا، بينما خطط الأسعار وميزاتها المتفرّعة تُدار بالكامل من اللوحة — بلغتين، مع اختيار أيقونة وتنشيط وإيقاف وإبراز للخطة المميّزة وترتيب للخطط ولميزات كل خطة. ومسارٌ واحد قائم على المعرّف يعرض كل صفحات تفاصيل الميزات من محتوى ثابت مُهيكل بدل تكرار تصميم لكل ميزة.',
      role: 'مطوّر متكامل. بنيتُ المشروع من الصفر — الموقع ثنائي اللغة المُصيَّر من جانب الخادم، ولوحة التحكّم، وإدارة خطط الأسعار وميزاتها ديناميكيًا، ومعالجة رسائل التواصل، وإدارة تحسين محركات البحث عامًّا وعلى مستوى الصفحة. أمّا التصميم البصري فقد وفّره مصمّم تجربة وواجهة، وشاركتُه بشكل موسّع في قرارات المنتج والواجهة. وكيّفتُ أساس لوحة SAMT ووحدات خلفية محدودة النطاق مثل المصادقة بدل إعادة بناء بدائل لها.',
      architecture:
        'Nuxt في الواجهة الأمامية مع تصيير من جانب الخادم للصفحات العامة، وخادم NestJS يعرض واجهات REST، و Prisma فوق SQLite للبيانات. وقد كُيّفت المعمارية والوحدات من مشروع SAMT الأسبق — إعادة استخدام على مستوى الوحدة، مُراجَعةً ومُلائَمةً لسياق هذا المنتج لا منقولةً نقلًا أعمى.',
      challenges:
        'لم يكن السؤال الأصعب تقنيًا بل تحريريًا: ما الذي يستحقّ أن يكون قابلًا للتهيئة أصلًا. فالمشروع يحتوي شروحًا مستقرّة للمنتج ومحتوى يتغيّر وفق جدوله الخاص، فجاءت قابلية التهيئة تبعًا لحاجة النشر الحقيقية لا مطبَّقةً في كل مكان. وجاء المحتوى المتفرّع ثنائي اللغة بمشكلته الخاصة: كل خطة والميزات داخلها تحتاج نصًّا عربيًا وإنجليزيًا وأيقونة وترتيبًا وحالةً وإبرازًا، وهذا لا يبقى قابلًا للإدارة إلا بقواعد واضحة للملكية والترتيب.',
      features:
        '- صفحات عامة ثنائية اللغة مُصيَّرة من جانب الخادم\n- خطط أسعار ديناميكية بميزات متفرّعة بلغتين\n- اختيار أيقونة وحالة تنشيط وإبراز لكل خطة\n- أدوات ترتيب للخطط ولميزات كل خطة\n- مسار واحد لتفاصيل الميزات يقوم على محتوى ثابت مُهيكل\n- إدارة رسائل التواصل\n- إدارة تحسين محركات البحث عامًّا وعلى مستوى الصفحة',
      lessonsLearned:
        'لقابلية التهيئة كلفة صيانة، فينبغي أن تتبع معدّل التغيّر الفعلي لا أن تُمنح افتراضيًا. كما أنّ اختلاف المسارات لا يستلزم اختلاف التنفيذ — فمسارٌ واحد مدفوع بالمحتوى خدَم كل صفحات الميزات دون تكرار تصميمها أو سلوكها.',
      metaTitle: 'زدني AI — دراسة حالة الموقع العام ونظام إدارة المحتوى',
      metaDescription:
        'موقع منتج ثنائي اللغة مُصيَّر من جانب الخادم ونظام إدارة محتوى بـ Nuxt و NestJS، مع خطط أسعار تُدار من اللوحة وأدوات لتحسين محركات البحث.',
    },
  },
  {
    // Nexa — an event-booking platform delivered to the client but NOT launched or operational at
    // documentation time, so no copy here claims otherwise. Team of 7; the constraints forbid claiming
    // he built it alone or holding a formal Team Lead title, and require the leadership to be described
    // through foundations, complex implementation and review. The design was provided.
    // GALLERY DELIBERATELY EMPTY: `screenshotsAllowed` is null (unconfirmed), and an empty gallery
    // must not block publication.
    featured: false,
    order: 6,
    year: 2025,
    liveUrl: 'https://nexasaudi.com',
    repoUrl: null,
    techKeys: ['nuxt', 'typescript', 'javascript'],
    en: {
      title: 'Nexa — Event Booking Platform',
      slug: 'nexa-event-booking-platform',
      summary:
        'A leading frontend role on an event-booking platform for the Saudi market: assigned-seat and open-capacity events, QR tickets, ticket gifting, and a visual venue and seat-map editor built with canvas and SVG.',
      overview:
        'An event-booking platform covering discovery, event details and booking for both assigned-seat and open-capacity events, with an administration dashboard for the people who run them. It was delivered to the client and had not yet been launched or made operational when this case study was written.',
      businessProblem:
        'Booking an event is not one problem. A concert with numbered seats needs individual seat availability; an open event only needs a capacity limit. Administrators also needed to define real hall layouts themselves, rather than waiting for a developer to hard-code each venue.',
      solution:
        'I separated venue and seat-map definitions from individual events, so the same hall can be reused across events without being redrawn, and gave administrators a graphical editor — built with canvas and SVG tooling — to draw the hall, place seats and group them into named groups with their own prices. Assigned-seat and open-capacity events are modelled as two explicit booking modes so neither inherits concepts it does not need. The same underlying seat-layout data drives both the administration editor and the customer booking view, with availability states layered on top.',
      role: 'Frontend Developer in a seven-person team of three frontend developers, two backend developers, a QA tester and a product manager. I established the frontend foundations, took the most complex frontend implementation tasks — including the venue and seat-map management experience — reviewed work delivered by other frontend team members, and contributed to frontend architecture and application-workflow decisions. The UI/UX design was provided before frontend implementation began.',
      architecture:
        'A Nuxt frontend in TypeScript and JavaScript, integrating customer and administration experiences with REST APIs through Nuxt’s data-fetching and state primitives. The seat-map work is built on canvas and SVG visualization, and reusable venue layouts are related to events rather than embedded in them.',
      challenges:
        'A spatial domain needs an interaction model that matches how people think about physical space, which is why the editor is graphical rather than a set of forms — at the cost of real coordinate-management complexity. Keeping the administrator’s arrangement and the customer’s view consistent was the other half of that problem, solved by driving both from one seat-layout model. Nested events under a parent event also needed a coherent relationship and presentation instead of appearing as unrelated records.',
      features:
        '- Event and concert discovery with event detail pages\n- Assigned-seat booking with seat availability visualization\n- Open-capacity booking with capacity limits\n- Reusable venue and hall layouts, related to events rather than duplicated\n- Visual seat-map editor with seat grouping and per-group pricing\n- QR tickets presented after booking\n- Ticket gifting between users\n- Parent and nested event organization\n- Administration dashboard',
      lessonsLearned:
        'Similar user journeys can require genuinely different domain rules underneath, and pretending otherwise produces one over-generalized flow that serves neither case. Reusability is also worth following where the business actually repeats itself — a hall really is used again — rather than only where the code repeats.',
      metaTitle: 'Nexa — Event Booking Platform Case Study',
      metaDescription:
        'A leading frontend role on an event-booking platform: assigned-seat and open-capacity events, QR tickets and a canvas/SVG venue and seat-map editor.',
    },
    ar: {
      title: 'نيكسا — منصّة حجز الفعاليات',
      slug: 'nexa-mansat-hajz-alfaaliyat',
      summary:
        'دور أمامي قيادي في منصّة حجز فعاليات للسوق السعودي: فعاليات بمقاعد مخصّصة وأخرى بسعة مفتوحة، وتذاكر QR، وإهداء التذاكر، ومحرّر مرئي للقاعات وخرائط المقاعد بـ canvas و SVG.',
      overview:
        'منصّة لحجز الفعاليات تغطّي الاستكشاف وتفاصيل الفعالية والحجز، للفعاليات ذات المقاعد المخصّصة وذات السعة المفتوحة معًا، مع لوحة تحكّم لمن يديرونها. سُلّمت المنصّة إلى العميل ولم تكن قد أُطلقت أو دخلت التشغيل بعد وقت كتابة دراسة الحالة هذه.',
      businessProblem:
        'حجز الفعالية ليس مسألة واحدة. فحفلٌ بمقاعد مرقّمة يحتاج تتبّعًا لتوفّر كل مقعد، أمّا الفعالية المفتوحة فتحتاج حدَّ سعة فقط. واحتاج المشرفون كذلك إلى تعريف مخطّطات القاعات الحقيقية بأنفسهم، لا انتظار مطوّر يبرمج كل قاعة يدويًا.',
      solution:
        'فصلتُ تعريفات القاعات وخرائط المقاعد عن الفعاليات المفردة، فأصبحت القاعة نفسها قابلة لإعادة الاستخدام في فعاليات عدّة دون إعادة رسمها، وأتحتُ للمشرفين محرّرًا مرئيًا — مبنيًّا بأدوات canvas و SVG — لرسم القاعة وتوزيع المقاعد وتجميعها في مجموعات مسمّاة لكلٍّ منها سعرها. ونُمذجت الفعاليات ذات المقاعد المخصّصة وذات السعة المفتوحة كنمطَي حجز صريحين، فلا يرث أحدهما مفاهيم لا يحتاجها. وتقود بيانات مخطّط المقاعد نفسها محرّر الإدارة وواجهة الحجز للعميل معًا، مع إضافة حالات التوفّر فوقها.',
      role: 'مطوّر واجهات أمامية في فريق من سبعة أفراد: ثلاثة مطوّري واجهات أمامية، ومطوّرا خلفية، ومختبر جودة، ومدير منتج. أرسيتُ أساسات الواجهة الأمامية، وتوليتُ أصعب مهامّ التنفيذ الأمامي — ومنها تجربة إدارة القاعات وخرائط المقاعد — وراجعتُ ما أنجزه أعضاء الفريق الآخرون في الواجهة الأمامية، وشاركتُ في قرارات معمارية الواجهة ومسارات التطبيق. وكان تصميم التجربة والواجهة جاهزًا قبل بدء التنفيذ الأمامي.',
      architecture:
        'واجهة أمامية بـ Nuxt باستخدام TypeScript و JavaScript، تربط تجربتَي العميل والإدارة بواجهات REST عبر أدوات Nuxt لجلب البيانات وإدارة الحالة. ويقوم عمل خرائط المقاعد على التمثيل المرئي بـ canvas و SVG، وتُربط مخطّطات القاعات القابلة لإعادة الاستخدام بالفعاليات بدل تضمينها فيها.',
      challenges:
        'المجال المكاني يحتاج نموذج تفاعل يطابق طريقة تفكير الناس في المكان المادي، ولهذا كان المحرّر مرئيًا لا مجموعة نماذج — وثمنُ ذلك تعقيدٌ حقيقي في إدارة الإحداثيات. وكان النصف الآخر من المسألة إبقاء ترتيب المشرف وعرض العميل متوافقين، وقد حُلّ بقيادة الاثنين من نموذج واحد لمخطّط المقاعد. كما احتاجت الفعاليات المتفرّعة تحت فعالية أمّ علاقةً وعرضًا متّسقين بدل أن تظهر سجلّات غير مترابطة.',
      features:
        '- استكشاف الفعاليات والحفلات مع صفحات لتفاصيل الفعالية\n- حجز بمقاعد مخصّصة مع تمثيل مرئي لتوفّر المقاعد\n- حجز بسعة مفتوحة مع حدود للسعة\n- مخطّطات قاعات قابلة لإعادة الاستخدام، مرتبطة بالفعاليات لا مكرّرة فيها\n- محرّر مرئي لخرائط المقاعد مع تجميع المقاعد وتسعير كل مجموعة\n- تذاكر QR تُعرض بعد الحجز\n- إهداء التذاكر بين المستخدمين\n- تنظيم الفعاليات الأمّ والفعاليات المتفرّعة\n- لوحة تحكّم للإدارة',
      lessonsLearned:
        'قد تستلزم المسارات المتشابهة قواعد مجال مختلفة فعلًا تحت السطح، وتجاهل ذلك يُنتج مسارًا واحدًا مفرط التعميم لا يخدم أيًّا من الحالتين. كما تستحقّ إعادة الاستخدام أن تتبع ما يتكرّر في العمل نفسه — فالقاعة تُستخدم مرارًا حقًّا — لا ما يتكرّر في الكود وحده.',
      metaTitle: 'نيكسا — دراسة حالة منصّة حجز الفعاليات',
      metaDescription:
        'دور أمامي قيادي في منصّة حجز فعاليات: مقاعد مخصّصة وسعة مفتوحة وتذاكر QR ومحرّر قاعات وخرائط مقاعد بـ canvas و SVG.',
    },
  },
  {
    // Rabiah Hospitals — a recovery project, and the constraints here are unusually specific. He did
    // NOT create the original frontend (he substantially modified and improved it); the previous
    // dashboard was lost because ACCESS TO THE HOSTED ACCOUNT was lost, NOT because of Strapi itself;
    // and Next.js is explicitly not his positioning, so the copy states the stack without leaning on it.
    //
    // `liveUrl` IS NULL BY EVIDENCE, not caution: the source says not to describe the domain as live
    // until confirmed reachable, and https://rabiahospitals.com was measured UNREACHABLE (curl exit 6,
    // HTTP 000) on 2026-08-07. Nothing here claims a current public production status.
    // GALLERY DELIBERATELY EMPTY: screenshot permission was never confirmed.
    featured: false,
    order: 7,
    year: 2026,
    liveUrl: null,
    repoUrl: null,
    techKeys: ['strapi', 'tailwind-css', 'javascript', 'deployment'],
    en: {
      title: 'Rabiah Hospitals — Website & CMS Recovery',
      slug: 'rabiah-hospitals-website-cms',
      summary:
        'Sole engineer on recovering a hospital website whose content-management system had become inaccessible — rebuilding the CMS from scratch against the existing frontend’s contract, then improving the public site before launch.',
      overview:
        'A hospital website backed by a rebuilt Strapi content-management system. The previous dashboard could no longer be reached, while the existing Next.js frontend still depended on its content structure, so the administration system was recreated from scratch and kept compatible with what the frontend already consumed. Substantial client-requested frontend improvements followed.',
      businessProblem:
        'The administration system had become unrecoverable — the loss was tied to access to the previous hosted account rather than to any fault in the CMS software itself. The public site still needed to be editable, the frontend still expected a particular content shape, and the client needed the result to stay under their own control afterwards.',
      solution:
        'I treated the frontend as the specification. Its data consumption revealed the real contract, so I rebuilt a Strapi dashboard that reproduces the content structures and REST responses it expected, which avoided rewriting a working frontend to suit a new backend. Then I improved that frontend rather than replacing it, implementing interface changes discussed directly with the client. The CMS was developed locally with a recoverable project copy retained, and prepared for deployment on infrastructure the client controls.',
      role: 'Full-Stack Developer and the sole engineer on the project. I analyzed the existing frontend’s expected content and API structure, rebuilt the CMS, configured it to manage the site’s full content, preserved compatibility with the frontend, implemented improvements to it after discussing them with the client, and prepared the deployment. I did not build the original frontend; I substantially modified and improved it.',
      architecture:
        'A Next.js frontend with Tailwind CSS, consuming REST APIs from a Strapi CMS over SQLite. The stack was inherited with the project rather than chosen. The consequential architectural decision was about ownership rather than technology: the CMS runs on infrastructure the client controls, with a recoverable local copy, so the system cannot again become unreachable because of one external account.',
      challenges:
        'Reconstructing an undocumented contract is careful work — the consuming application reveals what the backend really has to return, but only if the reconstruction is deliberate and validated rather than inferred loosely. Doing it while the client also wanted visible improvements meant separating the two scopes: compatibility work stayed narrow and finished first, then interface changes went in as discussed.',
      features:
        '- Rebuilt content-management dashboard covering the site’s full content\n- Content structures and REST responses compatible with the existing frontend\n- Homepage, departments, doctors, about and contact content under management\n- Client-requested improvements to the existing public frontend\n- Deployment prepared on client-controlled infrastructure\n- Recoverable local copy of the administration project retained',
      lessonsLearned:
        'A content system is not recoverable merely because it lives in the cloud. Account ownership, source access, backups and deployment control have to be planned explicitly — operational ownership is part of the architecture, and the client should know where the system lives, who controls access, and how it can be restored.',
      metaTitle: 'Rabiah Hospitals — Website & CMS Recovery Case Study',
      metaDescription:
        'Sole engineer rebuilding a hospital CMS from scratch against an existing frontend’s contract, then improving the public site — with ownership and recoverability designed in.',
    },
    ar: {
      title: 'مستشفيات رابية — استعادة الموقع ونظام إدارة المحتوى',
      slug: 'rabiah-mawqi-mustashfayat-wa-nizam-idara',
      summary:
        'المهندس الوحيد في استعادة موقع مستشفيات فقد إمكانية الوصول إلى نظام إدارة المحتوى الخاص به — إعادة بناء النظام من الصفر وفق عقد الواجهة الأمامية القائمة، ثم تحسين الموقع العام قبل الإطلاق.',
      overview:
        'موقع مستشفيات يقوم على نظام إدارة محتوى Strapi أُعيد بناؤه. لم تبقَ اللوحة السابقة قابلة للوصول، في حين ظلّت الواجهة الأمامية القائمة بـ Next.js تعتمد على بنية محتواها، فأُعيد إنشاء نظام الإدارة من الصفر مع الحفاظ على توافقه مع ما كانت الواجهة تستهلكه فعلًا. ثم تلت ذلك تحسينات جوهرية على الموقع العام بطلب العميل.',
      businessProblem:
        'صار نظام الإدارة غير قابل للاستعادة — وكان الفقد مرتبطًا بإمكانية الوصول إلى الحساب المُستضاف السابق، لا بخلل في برمجية إدارة المحتوى نفسها. وظلّ الموقع العام بحاجة إلى إمكانية التحرير، وظلّت الواجهة الأمامية تتوقّع شكلًا معيّنًا للمحتوى، واحتاج العميل أن تبقى النتيجة تحت سيطرته بعد ذلك.',
      solution:
        'تعاملتُ مع الواجهة الأمامية كمواصفة. فطريقة استهلاكها للبيانات كشفت العقد الحقيقي، فأعدتُ بناء لوحة Strapi تُنتج بنى المحتوى واستجابات REST التي كانت تتوقّعها، وهذا جنّبنا إعادة كتابة واجهة تعمل بالفعل لتلائم خلفية جديدة. ثم حسّنتُ تلك الواجهة بدل استبدالها، ونفّذتُ تغييرات في الواجهة نوقشت مع العميل مباشرة. وطُوِّر نظام إدارة المحتوى محليًا مع الاحتفاظ بنسخة قابلة للاستعادة، وجُهِّز للنشر على بنية تحتية يملكها العميل.',
      role: 'مطوّر متكامل والمهندس الوحيد في المشروع. حلّلتُ بنية المحتوى وواجهات البرمجة التي تتوقّعها الواجهة الأمامية القائمة، وأعدتُ بناء نظام إدارة المحتوى، وهيّأتُه لإدارة محتوى الموقع كاملًا، وحافظتُ على التوافق مع الواجهة، ونفّذتُ تحسينات عليها بعد مناقشتها مع العميل، وجهّزتُ النشر. ولم أبنِ الواجهة الأمامية الأصلية؛ بل عدّلتُها وحسّنتُها تعديلًا جوهريًا.',
      architecture:
        'واجهة أمامية بـ Next.js مع Tailwind CSS، تستهلك واجهات REST من نظام إدارة محتوى Strapi فوق SQLite. وقد وُرِثت هذه التقنيات مع المشروع لا أنها اختيرت. أمّا القرار المعماري ذو الأثر فكان في الملكية لا في التقنية: يعمل نظام إدارة المحتوى على بنية تحتية يسيطر عليها العميل، مع نسخة محلية قابلة للاستعادة، فلا يعود النظام غير قابل للوصول بسبب حساب خارجي واحد.',
      challenges:
        'إعادة بناء عقد غير موثّق عملٌ يحتاج تدقيقًا — فالتطبيق المستهلك يكشف ما يجب أن ترجعه الخلفية فعلًا، لكن بشرط أن تكون إعادة البناء مقصودة ومُتحقَّقًا منها لا مستنتجةً على عجل. وإتمام ذلك بينما يريد العميل تحسينات ظاهرة استدعى فصل النطاقين: بقي عمل التوافق ضيّقًا وأُنجز أولًا، ثم دخلت تغييرات الواجهة كما نوقشت.',
      features:
        '- لوحة إدارة محتوى أُعيد بناؤها تغطّي محتوى الموقع كاملًا\n- بنى محتوى واستجابات REST متوافقة مع الواجهة الأمامية القائمة\n- إدارة محتوى الصفحة الرئيسية والأقسام والأطباء وصفحتَي «من نحن» و«تواصل»\n- تحسينات على الواجهة الأمامية العامة بطلب العميل\n- تجهيز النشر على بنية تحتية يملكها العميل\n- الاحتفاظ بنسخة محلية قابلة للاستعادة من مشروع الإدارة',
      lessonsLearned:
        'نظام المحتوى لا يكون قابلًا للاستعادة بمجرّد أنّه في السحابة. فملكية الحساب والوصول إلى المصدر والنسخ الاحتياطية والسيطرة على النشر أمورٌ تُخطَّط صراحةً — الملكية التشغيلية جزء من المعمارية، وعلى العميل أن يعرف أين يعيش النظام ومن يملك الوصول إليه وكيف يُستعاد.',
      metaTitle:
        'مستشفيات رابية — دراسة حالة استعادة الموقع ونظام إدارة المحتوى',
      metaDescription:
        'المهندس الوحيد في إعادة بناء نظام إدارة محتوى مستشفى من الصفر وفق عقد واجهة قائمة، ثم تحسين الموقع العام — مع تصميم الملكية والقابلية للاستعادة.',
    },
  },
  {
    // LavaStack — the source itself classifies this as a SUPPORTING case study that should not displace
    // flagship work, which is exactly why it is ordered last and left non-featured. Constraints: he did
    // not implement the whole frontend alone; NO measured performance claims are permitted (no real
    // measurements exist), so the copy speaks of judgement and removal, never percentages; and
    // Laravel/Filament must not read as his primary positioning.
    featured: false,
    order: 8,
    year: 2025,
    liveUrl: 'https://lavastack.dev',
    repoUrl: null,
    techKeys: ['nuxt', 'tailwind-css', 'laravel', 'php', 'performance'],
    en: {
      title: 'LavaStack — Software Team Portfolio',
      slug: 'lavastack-team-portfolio',
      summary:
        'Full-stack work on a software team’s portfolio site, then a review pass over the finished frontend — refining the homepage and removing animation that cost more in usability than it returned.',
      overview:
        'A portfolio website for a software team, presenting its services, projects, articles, company information and client testimonials through a public Nuxt frontend with a Laravel Filament administration portal behind it. Delivered over roughly one month and available online.',
      businessProblem:
        'The site had to present a software team credibly to potential clients, and its content — projects, services, articles — needed to be maintained by administrators rather than developers. After the first implementation was complete, the homepage still needed work: it looked impressive in places where that came at the cost of how it actually felt to use.',
      solution:
        'I contributed across the frontend and backend, using Laravel Filament to manage projects, services and articles so the team was not building every administration primitive from scratch, and connecting the Nuxt frontend to its REST APIs. Then I did something distinct from feature work: a dedicated review pass over the completed frontend, focused on the homepage’s layout and presentation, and on animation-heavy sections that weakened the experience on mobile. Where an effect did not justify its cost, I reduced or removed it.',
      role: 'Full-Stack Developer on a three-person team. I worked across the stack and later reviewed and improved the completed frontend — the homepage’s visual presentation, its usability, and the motion that was hurting it. I did not implement the entire frontend; another team member delivered the initial implementation, and my changes were targeted rather than a rewrite. This was also my first hands-on project with Filament.',
      architecture:
        'A Nuxt frontend with Tailwind CSS consuming REST APIs from a Laravel backend, with Filament providing the administration portal and MySQL behind it. The split is deliberate: the administration experience follows Filament’s conventions, while the public site stays a custom Nuxt experience rather than inheriting an admin framework’s look.',
      challenges:
        'The honest difficulty was judging performance without measurements. Some animations visibly weakened the experience on mobile, and no instrumentation existed to quantify it — so the decision had to rest on reviewing the animation-heavy sections and asking whether each effect earned its cost. It also meant improving another developer’s work, which calls for understanding the original intent, preserving what functions, and changing only what needs changing.',
      features:
        '- Public pages for services, projects, articles, about and client testimonials\n- Laravel Filament administration for projects, services and articles\n- Nuxt frontend integrated with the backend over REST APIs\n- Homepage layout and presentation refined after initial delivery\n- Animation-heavy sections reduced or removed where they harmed usability',
      lessonsLearned:
        'An interface should not keep an effect merely because it looks impressive; good UX sometimes means deleting something visually attractive because the product is better to use without it. And improvement work on someone else’s code is a different discipline from writing your own — the goal is targeted change, not rewriting for ownership.',
      metaTitle: 'LavaStack — Software Team Portfolio Case Study',
      metaDescription:
        'Full-stack work on a software team’s portfolio site, plus a frontend review pass that refined the homepage and cut motion that hurt usability.',
    },
    ar: {
      title: 'لافاستاك — موقع فريق برمجيات',
      slug: 'lavastack-mawqi-farik-barmajiyat',
      summary:
        'عمل متكامل على موقع أعمال فريق برمجيات، ثم جولة مراجعة للواجهة الأمامية بعد إنجازها — تحسين الصفحة الرئيسية وإزالة حركات كانت كلفتها في سهولة الاستخدام أكبر من عائدها.',
      overview:
        'موقع أعمال لفريق برمجيات، يعرض خدماته ومشاريعه ومقالاته ومعلومات الشركة وشهادات العملاء عبر واجهة أمامية عامة بـ Nuxt، وخلفها بوّابة إدارة بـ Laravel Filament. سُلّم خلال شهر تقريبًا وهو متاح على الإنترنت.',
      businessProblem:
        'كان على الموقع أن يقدّم فريق برمجيات تقديمًا موثوقًا للعملاء المحتملين، وأن يكون محتواه — المشاريع والخدمات والمقالات — قابلًا للإدارة من المشرفين لا المطوّرين. وبعد إنجاز التنفيذ الأول، بقيت الصفحة الرئيسية بحاجة إلى عمل: كانت مبهرة في مواضع جاء إبهارها فيها على حساب إحساس الاستخدام الفعلي.',
      solution:
        'ساهمتُ في الواجهة الأمامية والخلفية، مستخدمًا Laravel Filament لإدارة المشاريع والخدمات والمقالات حتى لا يبني الفريق كل بدائيات الإدارة من الصفر، ورابطًا واجهة Nuxt بواجهات REST الخاصة به. ثم قمتُ بعمل مختلف عن تطوير الميزات: جولة مراجعة مخصّصة للواجهة الأمامية المُنجَزة، تركّز على تصميم الصفحة الرئيسية وعرضها، وعلى الأقسام كثيفة الحركة التي كانت تُضعف التجربة على الهاتف. وحيث لم يكن التأثير يستحقّ كلفته، قلّصتُه أو أزلتُه.',
      role: 'مطوّر متكامل في فريق من ثلاثة أفراد. عملتُ على طرفَي المشروع، ثم راجعتُ الواجهة الأمامية المُنجَزة وحسّنتُها — العرض البصري للصفحة الرئيسية وسهولة استخدامها والحركة التي كانت تضرّ بها. ولم أنفّذ الواجهة الأمامية كاملةً؛ فقد أنجز عضو آخر التنفيذ الأوّلي، وكانت تغييراتي موجَّهة لا إعادة كتابة. وكان هذا أيضًا أول مشروع أعمل فيه عمليًا بـ Filament.',
      architecture:
        'واجهة أمامية بـ Nuxt مع Tailwind CSS تستهلك واجهات REST من خلفية Laravel، مع Filament لبوّابة الإدارة و MySQL خلفها. والفصل مقصود: تتبع تجربة الإدارة أعراف Filament، بينما يبقى الموقع العام تجربة Nuxt مخصّصة لا تُورَّث مظهر إطار إداري.',
      challenges:
        'كانت الصعوبة الحقيقية في الحكم على الأداء دون قياسات. فبعض الحركات كانت تُضعف التجربة على الهاتف بشكل ظاهر، ولم تكن هناك أدوات قياس تُحدِّد ذلك رقميًا — فاستند القرار إلى مراجعة الأقسام كثيفة الحركة والسؤال عمّا إذا كان كل تأثير يستحقّ كلفته. كما استلزم الأمر تحسين عمل مطوّر آخر، وهذا يقتضي فهم المقصد الأصلي والحفاظ على ما يعمل وتغيير ما يحتاج التغيير وحده.',
      features:
        '- صفحات عامة للخدمات والمشاريع والمقالات و«من نحن» وشهادات العملاء\n- إدارة بـ Laravel Filament للمشاريع والخدمات والمقالات\n- واجهة Nuxt مرتبطة بالخلفية عبر واجهات REST\n- تحسين تصميم الصفحة الرئيسية وعرضها بعد التسليم الأوّلي\n- تقليص أو إزالة الأقسام كثيفة الحركة حيث أضرّت بسهولة الاستخدام',
      lessonsLearned:
        'لا ينبغي للواجهة أن تُبقي تأثيرًا لمجرّد أنّه يبدو مبهرًا؛ فتجربة الاستخدام الجيدة تعني أحيانًا حذف شيء جميل بصريًا لأنّ المنتج أفضل استخدامًا بدونه. كما أنّ تحسين كود شخص آخر انضباط مختلف عن كتابة كودك — الهدف تغييرٌ موجَّه لا إعادة كتابة لأجل الملكية.',
      metaTitle: 'لافاستاك — دراسة حالة موقع فريق برمجيات',
      metaDescription:
        'عمل متكامل على موقع أعمال فريق برمجيات، مع جولة مراجعة للواجهة حسّنت الصفحة الرئيسية وأزالت حركة أضرّت بسهولة الاستخدام.',
    },
  },
];
