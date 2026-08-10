// Standalone DEV/DEMO overlay — the development-only half of the seed (doc 09 §6, D09-15).
// Invoked via `npm run db:seed:dev`. **It must never run in production.**
//
// WHAT THIS IS NOW. The realistic bilingual portfolio content this file used to own — skills,
// projects, experiences, categories, tags and articles — moved to the CANONICAL dataset under
// `prisma/content/canonical/` (doc 09 §6.1), because it is the content production is supposed to
// serve. It was never really "demo" data; it was the real content, living in a script that
// production was forbidden to run. This overlay keeps only what is genuinely NOT canonical.
//
// Run order (unchanged): `npm run db:seed` → `npm run db:seed:dev`.
// The overlay applies the canonical synchronization first, so a development database converges to
// exactly what production converges to — one dataset, one code path, no drift between what is
// developed against and what is shipped. It then adds the development-only fixtures below.
//
// Locales (en/ar) are assumed present — the base seed creates them and the synchronization refuses
// to run without them. Media FKs are left null so no storage pipeline is required.
import 'reflect-metadata';
import { createPrismaClient } from '../src/prisma/standalone-client';
import { applyPlan } from './sync/apply-plan';
import { buildPlan } from './sync/build-plan';
import { readOnly } from './sync/read-client';
import { isNoOp, summarize } from './sync/types';

const prisma = createPrismaClient();

const LOCALE_EN = 'en';
const LOCALE_AR = 'ar';

// ===== Development-only fixtures =====
//
// Testimonials are DELIBERATELY NOT canonical and are NOT in the synchronization's allowlist. The
// owner profile provides no real recommendations, so the entries below are clearly-sample content
// for local development. Publishing invented praise would be exactly the fabrication D02-2 forbids,
// and a tool that cannot tell "not canonical" from "should be deleted" must do nothing rather than
// guess — so the synchronization leaves any existing Testimonial rows untouched in every database,
// including production. Real testimonials are pending owner input.

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

// Demo/placeholder testimonials — NO governing decision authorizes these, which is the point of
// keeping them here in the DEV seed only. The owner-profile provides no real recommendations, so these are
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

async function main(): Promise<void> {
  // The SAME plan builder and apply path production uses. A development database that converged by
  // a different mechanism would not be evidence of anything about production.
  const plan = await buildPlan(readOnly(prisma));
  if (plan.problems.length)
    throw new Error(
      `Canonical synchronization cannot run:\n${plan.problems.map((problem) => `  - ${problem}`).join('\n')}`,
    );

  const summary = summarize(plan);
  if (!isNoOp(plan)) {
    await applyPlan(prisma, plan);
  }

  const testimonialsCreated = await ensureTestimonials();

  console.log(
    'Dev overlay complete (idempotent; en + ar for every localized entity):\n' +
      `  Canonical sync: ${summary.creates} created, ${summary.updates} updated, ` +
      `${summary.deletes} deleted, ${summary.hides} hidden, ${summary.unchanged} unchanged\n` +
      `                  ${summary.relationAdditions} relation(s) added, ` +
      `${summary.relationRemovals} removed\n` +
      `  Testimonials:   ${TESTIMONIALS.length} total (created ${testimonialsCreated}) — dev-only, never synchronized`,
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
