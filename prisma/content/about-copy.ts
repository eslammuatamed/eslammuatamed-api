// Owner-approved About copy (SiteSettingsTranslation.aboutBio / engineeringPhilosophy /
// currentFocus), transcribed verbatim from the governed content source:
//
//   repository : eslammuatamed-docs
//   commit     : 78bc945d32c8ab37a9a8ebfc3ac957489bd441df
//   file       : content/profile/about-copy.md  (Status: Approved · Version 1.0.0 · 2026-07-29)
//   section    : §5 "Approved copy"
//
// That document states the API seed consumes it (§4). The transcription is deliberate: this
// repository must not import or depend on the Docs repository at runtime, so the bytes live
// here and are guarded instead. `test/about-content.e2e-spec.ts` re-derives SHA-256 over the
// values actually read back from a seeded database and compares them to hashes recorded
// independently of this module — so a drift or a typo here fails CI rather than shipping.
//
// Wording changes require owner review (about-copy.md §4). Do not rewrite, normalise, rewrap,
// translate, shorten, or "fix" punctuation here. `aboutBio` and `engineeringPhilosophy` are
// Markdown source (paragraphs separated by a blank line, i.e. "\n\n"); `currentFocus` is
// plain text. All are resolved per locale with no cross-locale fallback (D10-6).

export interface AboutCopy {
  readonly aboutBio: string;
  readonly engineeringPhilosophy: string;
  readonly currentFocus: string;
}

export const ABOUT_COPY: Readonly<Record<'en' | 'ar', AboutCopy>> = {
  en: {
    aboutBio:
      "I'm a JavaScript Product Engineer — frontend-led, with end-to-end product delivery experience. My deepest specialization is frontend engineering: scalable Vue.js and Nuxt.js architecture, reusable application foundations, performance, SEO, and interfaces that remain maintainable.\n\nI've worked professionally on the web since November 2023. At WeblyTech, I built Nuxt implementations across client products. At Findropica, I'm the sole frontend developer on Zidni, a production e-learning platform. I also built SAMT — a bilingual institution website, its NestJS API, and its custom CMS — from scratch as the sole engineer, working from a designer's Figma files.\n\nAs my delivery scope widened, I began building the systems around the frontend: NestJS APIs, Prisma data layers, content platforms, and deployment and recovery workflows. I describe that as frontend-led product engineering — a clear specialization, with end-to-end responsibility when the product requires it.",
    engineeringPhilosophy:
      "I prefer maintainability over cleverness. Code is read far more often than it is written, so consistency, clear naming, and documentation are product qualities, not overhead.\n\nPerformance, accessibility, and SEO are constraints I design under, not checks I postpone until the end. A budget that is neither measured nor enforced is not a meaningful budget.\n\nI don't introduce complexity without a demonstrated reason. An abstraction earns its place by removing duplication that already exists, not by anticipating a future that may never arrive. I would also rather explain plainly what a system does than hide it behind buzzwords.",
    currentFocus:
      'Building bilingual web products with Nuxt at Findropica, using NestJS when I own the supporting API and CMS, and developing this platform as an open record of how I work.',
  },
  ar: {
    aboutBio:
      'أنا مهندس برمجيات للمنتجات، متخصص في الواجهات الأمامية. أعمق مجالات تخصصي هو هندسة الواجهات الأمامية: بناء معماريات قابلة للتوسّع باستخدام Vue.js وNuxt.js، وتطوير أسس تطبيقات قابلة لإعادة الاستخدام، وتحسين الأداء ومحركات البحث، وإنشاء واجهات تظل قابلة للصيانة مع نمو المنتج.\n\nأعمل في تطوير الويب احترافيًا منذ نوفمبر 2023. في WeblyTech بنيت تطبيقات وتجارب تعتمد على Nuxt ضمن عدة منتجات للعملاء. وفي Findropica أنا المطوّر الوحيد للواجهات الأمامية في Zidni، وهي منصة تعليمية تعمل في الإنتاج. كما بنيت SAMT — موقع مؤسسة ثنائي اللغة، وواجهة برمجية باستخدام NestJS، ونظام إدارة محتوى مخصص — من الصفر بصفتي المهندس الوحيد، اعتمادًا على تصميمات أعدّها مصمم باستخدام Figma.\n\nومع اتّساع نطاق مسؤوليتي في التسليم، بدأت أبني الأنظمة المحيطة بالواجهة الأمامية أيضًا: واجهات برمجية باستخدام NestJS، وطبقات بيانات باستخدام Prisma، ومنصات محتوى، ومسارات النشر والاستعادة. أصف ذلك بأنه هندسة منتجات تقودها الواجهة الأمامية: تخصص واضح، مع مسؤولية تمتد عبر طبقات المنتج عندما يتطلب العمل ذلك.',
    engineeringPhilosophy:
      'أُفضّل قابلية الصيانة على الاستعراض التقني. فالشيفرة تُقرأ أكثر بكثير مما تُكتب، ولذلك يُعد الاتساق ووضوح التسمية والتوثيق من خصائص جودة المنتج، لا أعباء إضافية.\n\nالأداء وإتاحة الوصول وتحسين محركات البحث قيود أُصمم ضمنها منذ البداية، وليست فحوصًا أؤجلها إلى نهاية العمل. والميزانية التي لا تخضع للقياس والإنفاذ ليست ميزانية فعلية.\n\nلا أضيف تعقيدًا من دون سبب مثبت. فالتجريد يستحق مكانه عندما يزيل تكرارًا موجودًا بالفعل، لا عندما يستبق مستقبلًا قد لا يأتي. كما أُفضّل شرح ما يفعله النظام بوضوح على إخفائه خلف مصطلحات رنانة.',
    currentFocus:
      'أبني منتجات ويب ثنائية اللغة باستخدام Nuxt في Findropica، وأستخدم NestJS عندما أتولى الواجهة البرمجية ونظام إدارة المحتوى الداعمين للمنتج، كما أطور هذه المنصة لتكون سجلًا مفتوحًا لطريقتي في العمل.',
  },
} as const;
