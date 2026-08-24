import { ApiResponseExamples } from '@nestjs/swagger';

/**
 * Named, locale-representative response examples for `GET /settings/site` (doc 10 §1, D10-6).
 *
 * WHY THESE EXIST AT ALL. The 200 response previously carried no `examples` and no `example`, only
 * schema-level property examples — which are LOCALE-BLIND. Any contract mock replaying this
 * operation therefore answered `?locale=ar` with the English `siteName`, so the Arabic site
 * rendered a Latin `h1` under an Arabic font stack. Locale resolution is real at runtime; it was
 * the CONTRACT that could not express it. These two examples are what makes a mock able to.
 *
 * They are addressable by name, so a consumer's contract harness selects one explicitly
 * (`Prefer: example=en` / `Prefer: example=ar` — Stoplight Prism's documented mechanism).
 * Nothing here changes runtime behaviour: the service still resolves `?locale=` from the database.
 *
 * VALUE PROVENANCE — nothing in these payloads is invented:
 *
 *   - the governed localized identity and the governed scalars are the CANONICAL DATASET's values
 *     (`prisma/content/canonical/site-settings.ts`), which is also what `db:seed` and
 *     `content:sync:apply` write to the deployed database;
 *   - the operator-owned fields (verification tokens, tracking, custom metas, media descriptors)
 *     have no canonical source — the live singleton holds none of them — so they reproduce the
 *     contract's OWN existing schema-level examples verbatim.
 *
 * The literals are duplicated from the canonical dataset rather than imported because
 * `tsconfig.build.json` excludes `prisma/`: a runtime import from `src/` would pull that tree into
 * the build, restructure `dist/`, and break `start:prod`. The duplication is COUPLED BY A TEST
 * instead — `site-settings.examples.spec.ts` imports the canonical dataset (jest's `roots` covers
 * `prisma/`, and specs are excluded from the build) and fails if any governed value drifts. That
 * guard is the point: an uncoupled literal that silently goes stale is precisely the defect.
 *
 * GENERATED ONCE from the canonical dataset to rule out transcription error in the Arabic strings,
 * then maintained by hand under the test above. Do not rewrite, normalise or "fix" the copy —
 * including the newline in `tagline`, which is part of the approved two-line title
 * (positioning-strategy §2).
 */
export const PUBLIC_SITE_SETTINGS_RESPONSE_EXAMPLES: Record<
  'en' | 'ar',
  ApiResponseExamples
> = {
  en: {
    summary: 'English (?locale=en) — the resolved English site settings.',
    value: {
      data: {
        siteName: 'Eslam Muatamed',
        tagline: 'Full-Stack JavaScript\nProduct Engineer',
        defaultMetaTitle: 'Eslam Muatamed',
        defaultMetaDescription:
          'Full-Stack JavaScript Product Engineer building production-ready web products with strong frontend architecture, reliable Node.js and NestJS backends, and end-to-end delivery.',
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
            url: 'mailto:contact@eslammuatamed.com',
            icon: 'i-lucide-mail',
          },
        ],
        availabilityStatus: 'Open to frontend opportunities',
        careerStartYear: '2023',
        careerStartMonth: 11,
        googleSiteVerification: 'google-abc123',
        bingSiteVerification: 'bing-def456',
        gtmContainerId: null,
        customMetas: [
          {
            name: 'theme-color',
            content: '#0b0b0f',
          },
        ],
        resumeAsset: {
          id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
          kind: 'PDF',
          url: 'https://media.eslammuatamed.com/media/8f…/document.pdf',
          filename: 'eslam-muatamed-resume.pdf',
          sizeBytes: 245123,
        },
        portraitAssetId: '007b32d5-7fde-4e61-9557-7e2c5ee195bf',
        portrait: {
          id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
          kind: 'IMAGE',
          url: 'https://media.eslammuatamed.com/media/8f…/1920-webp.webp',
          width: 1920,
          height: 1080,
          blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
          alt: 'A laptop on a wooden desk',
          variants: [
            {
              format: 'WEBP',
              width: 1280,
              height: 720,
              url: 'https://media.eslammuatamed.com/media/8f…/1280-webp.webp',
            },
          ],
        },
        professionalEmail: 'hello@eslammuatamed.com',
        contactEmail: 'contact@eslammuatamed.com',
        contactPhone: '+201002785408',
        whatsappPhone: '+201002785408',
        aboutBio:
          "I’m a Full-Stack JavaScript Product Engineer who turns product requirements into production-ready web products. I combine strong frontend architecture with reliable Node.js and NestJS backend development, taking features from requirements analysis and implementation through testing, performance, technical SEO, and deployment.\n\nI've worked professionally on the web since November 2023. At WeblyTech, I built Nuxt implementations across client products. At Findropica, I'm the sole frontend developer on Zidni, a production e-learning platform. I also built SAMT — a bilingual institution website, its NestJS API, and its custom CMS — from scratch as the sole engineer, working from a designer's Figma files.\n\nI work across the full product lifecycle, from understanding requirements and shaping the architecture to implementation, testing, performance, technical SEO, and deployment. I’m at my best when I can take ownership of a feature end to end and turn an evolving requirement into a reliable product experience.",
        engineeringPhilosophy:
          "I prefer maintainability over cleverness. Code is read far more often than it is written, so consistency, clear naming, and documentation are product qualities, not overhead.\n\nPerformance, accessibility, and SEO are constraints I design under, not checks I postpone until the end. A budget that is neither measured nor enforced is not a meaningful budget.\n\nI don't introduce complexity without a demonstrated reason. An abstraction earns its place by removing duplication that already exists, not by anticipating a future that may never arrive. I would also rather explain plainly what a system does than hide it behind buzzwords.",
        currentFocus:
          'Building bilingual web products with Nuxt at Findropica, using NestJS when I own the supporting API and CMS, and developing this platform as an open record of how I work.',
        availableLocales: ['en', 'ar'],
      },
    },
  },
  ar: {
    summary: 'Arabic (?locale=ar) — the resolved Arabic site settings.',
    value: {
      data: {
        siteName: 'إسلام معتمد',
        tagline: 'Full-Stack JavaScript\nProduct Engineer',
        defaultMetaTitle: 'إسلام معتمد',
        defaultMetaDescription:
          'Full-Stack JavaScript Product Engineer، أبني منتجات ويب جاهزة للإطلاق ببنية قوية للواجهات الأمامية، وخلفيات موثوقة باستخدام Node.js وNestJS، وتنفيذ متكامل من البداية إلى النهاية.',
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
            url: 'mailto:contact@eslammuatamed.com',
            icon: 'i-lucide-mail',
          },
        ],
        availabilityStatus: 'متاح لفرص عمل في تطوير الواجهات الأمامية',
        careerStartYear: 2023,
        careerStartMonth: 11,
        googleSiteVerification: 'google-abc123',
        bingSiteVerification: 'bing-def456',
        gtmContainerId: null,
        customMetas: [
          {
            name: 'theme-color',
            content: '#0b0b0f',
          },
        ],
        resumeAsset: {
          id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
          kind: 'PDF',
          url: 'https://media.eslammuatamed.com/media/8f…/document.pdf',
          filename: 'eslam-muatamed-resume.pdf',
          sizeBytes: 245123,
        },
        portraitAssetId: '007b32d5-7fde-4e61-9557-7e2c5ee195bf',
        portrait: {
          id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
          kind: 'IMAGE',
          url: 'https://media.eslammuatamed.com/media/8f…/1920-webp.webp',
          width: 1920,
          height: 1080,
          blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
          alt: 'A laptop on a wooden desk',
          variants: [
            {
              format: 'WEBP',
              width: 1280,
              height: 720,
              url: 'https://media.eslammuatamed.com/media/8f…/1280-webp.webp',
            },
          ],
        },
        professionalEmail: 'hello@eslammuatamed.com',
        contactEmail: 'contact@eslammuatamed.com',
        contactPhone: '+201002785408',
        whatsappPhone: '+201002785408',
        aboutBio:
          'أنا Full-Stack JavaScript Product Engineer، أحوّل متطلبات المنتج إلى منتجات ويب جاهزة للإطلاق. أجمع بين بنية قوية للواجهات الأمامية وتطوير موثوق للواجهات الخلفية باستخدام Node.js وNestJS، وأتولى تنفيذ المزايا من تحليل المتطلبات والتطوير إلى الاختبار والأداء وتهيئة محركات البحث التقنية والنشر.\n\nأعمل في تطوير الويب احترافيًا منذ نوفمبر 2023. في WeblyTech بنيت تطبيقات وتجارب تعتمد على Nuxt ضمن عدة منتجات للعملاء. وفي Findropica أنا المطوّر الوحيد للواجهات الأمامية في Zidni، وهي منصة تعليمية تعمل في الإنتاج. كما بنيت SAMT — موقع مؤسسة ثنائي اللغة، وواجهة برمجية باستخدام NestJS، ونظام إدارة محتوى مخصص — من الصفر بصفتي المهندس الوحيد، اعتمادًا على تصميمات أعدّها مصمم باستخدام Figma.\n\nأعمل عبر دورة المنتج كاملة، من فهم المتطلبات وتحديد البنية المناسبة إلى التطوير والاختبارات والأداء وتهيئة محركات البحث التقنية والنشر. أقدّم أفضل قيمة عندما أتولى الميزة من بدايتها إلى نهايتها، وأحوّل المتطلبات المتطورة إلى تجربة منتج موثوقة وجاهزة للإطلاق.',
        engineeringPhilosophy:
          'أُفضّل قابلية الصيانة على الاستعراض التقني. فالشيفرة تُقرأ أكثر بكثير مما تُكتب، ولذلك يُعد الاتساق ووضوح التسمية والتوثيق من خصائص جودة المنتج، لا أعباء إضافية.\n\nالأداء وإتاحة الوصول وتحسين محركات البحث قيود أُصمم ضمنها منذ البداية، وليست فحوصًا أؤجلها إلى نهاية العمل. والميزانية التي لا تخضع للقياس والإنفاذ ليست ميزانية فعلية.\n\nلا أضيف تعقيدًا من دون سبب مثبت. فالتجريد يستحق مكانه عندما يزيل تكرارًا موجودًا بالفعل، لا عندما يستبق مستقبلًا قد لا يأتي. كما أُفضّل شرح ما يفعله النظام بوضوح على إخفائه خلف مصطلحات رنانة.',
        currentFocus:
          'أبني منتجات ويب ثنائية اللغة باستخدام Nuxt في Findropica، وأستخدم NestJS عندما أتولى الواجهة البرمجية ونظام إدارة المحتوى الداعمين للمنتج، كما أطور هذه المنصة لتكون سجلًا مفتوحًا لطريقتي في العمل.',
        availableLocales: ['en', 'ar'],
      },
    },
  },
};
