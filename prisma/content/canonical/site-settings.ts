// Canonical SiteSettings (doc 09 §6.3). The singleton's governed scalar subset plus the governed
// per-locale identity/About fields. Pure data — no database calls.
//
// EVERY field named here is re-asserted on every synchronization run, create or update alike. That
// is the correction the create-only base seed needs: `siteName`, `availabilityStatus`,
// `defaultMetaTitle` and `defaultMetaDescription` were written once at first provisioning and then
// never spoken about again, so an already-provisioned database kept them on their creation values
// permanently and silently.
//
// Fields deliberately ABSENT from this module are operator-owned and the synchronization must never
// touch them: `resumeAssetId`, `portraitAssetId`, `googleSiteVerification`, `bingSiteVerification`,
// `analyticsProvider`, `analyticsMeasurementId`, `analyticsEnabled`, `customMetas`. The footer, the
// contact sidebar and the résumé settings have no columns of their own — the Web layer composes them
// from the governed fields below plus the operator-owned `resumeAssetId`, which stays null until a
// real PDF is uploaded. No value is invented here that a canonical source does not state.
import { ABOUT_COPY } from '../about-copy';
import { PUBLIC_TAGLINE } from '../public-tagline';

export interface ProfileLink {
  readonly label: string;
  readonly url: string;
  readonly icon: string;
}

export interface CanonicalSettingsScalars {
  readonly profileLinks: readonly ProfileLink[];
  readonly careerStartYear: number;
  readonly careerStartMonth: number;
  readonly professionalEmail: string;
  readonly contactEmail: string;
  readonly contactPhone: string;
  readonly whatsappPhone: string;
}

export interface CanonicalSettingsTranslation {
  readonly locale: string;
  readonly siteName: string;
  readonly tagline: string;
  readonly availabilityStatus: string;
  readonly defaultMetaTitle: string;
  readonly defaultMetaDescription: string;
  readonly aboutBio: string;
  readonly engineeringPhilosophy: string;
  readonly currentFocus: string;
}

/**
 * The public-website contact address (owner-profile §8, approved 2026-07-29).
 *
 * ONE CONSTANT, TWO GOVERNED SURFACES, BY CONSTRUCTION. It backs both the public `Email` profile
 * link and the `contactEmail` scalar, because both are published to visitors and both are written to
 * Production by `content:sync:apply` — they are the same fact, and holding it twice as a literal is
 * exactly how they came to disagree. This is deliberately NOT the pattern used for
 * `contactPhone`/`whatsappPhone` below: those are independently governed fields that merely happen to
 * share a value today, whereas these two are one address rendered in two places.
 */
const PUBLIC_CONTACT_EMAIL = 'contact@eslammuatamed.com';

// Real owner links (HR-8, owner-profile §8): GitHub grounded in the actual repo host, canonical
// LinkedIn (R7), and the public contact address. X/Twitter is omitted: the profile lists no handle
// and one must not be invented.
//
// THE EMAIL LINK CARRIED `eslammuatemed@gmail.com` AND MUST NOT. Its comment cited R5, which named
// the personal Gmail the canonical public address — but **R10 superseded R5 on 2026-07-29**, and the
// §8 table that replaced it marks that Gmail "Never rendered publicly", demoted to the internal
// Contact-form notification destination. `profileLinks` is in `GOVERNED_SETTINGS_SCALARS`
// (`prisma/sync/allowlist.ts`), so this value is written to Production by `content:sync:apply` and
// published to every visitor. The comment was accurate when written and became false when the
// decision moved; the code followed the stale citation.
//
// `contact@` rather than `hello@` is stated by §8's surface-mapping table, not inferred from it:
// the public website — anywhere a visitor writes in, including this `Email` entry and the
// `contactEmail` scalar — takes `contact@`, while `hello@` serves the professional identity
// surfaces the owner publishes outward (CV, Résumé, LinkedIn, outbound applications). Owner
// decision **R15** (2026-08-05) closed the question and named both governed fields explicitly.
//
// (R5's separate finding stands and is not disturbed: the "mu**ate**med" spelling in the Gmail is
// intentional and not a typo — which is precisely why it read as plausible and survived this long.)
export const PROFILE_LINKS: readonly ProfileLink[] = [
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
    url: `mailto:${PUBLIC_CONTACT_EMAIL}`,
    icon: 'i-lucide-mail',
  },
];

// Approved public addresses (owner-profile §8, confirmed 2026-07-29) and the owner-approved public
// numbers (D10-16), stored in E.164. `contactPhone` and `whatsappPhone` are deliberately two fields
// holding the same value rather than one shared constant: they are independently governed, and
// collapsing them would quietly reintroduce the inference D09-19 forbids — not every telephone
// number has WhatsApp.
export const SETTINGS_SCALARS: CanonicalSettingsScalars = {
  profileLinks: PROFILE_LINKS,
  careerStartYear: 2023,
  careerStartMonth: 11,
  professionalEmail: 'hello@eslammuatamed.com',
  contactEmail: PUBLIC_CONTACT_EMAIL,
  contactPhone: '+201002785408',
  whatsappPhone: '+201002785408',
};

// Positioning per the content source of truth. `tagline` is the approved public title, governed
// literally by positioning-strategy.md §2/§3 and imported rather than written here; the About prose
// comes from about-copy.ts for the same reason. Locale-complete, no cross-locale fallback (D10-6).
export const SETTINGS_TRANSLATIONS: readonly CanonicalSettingsTranslation[] = [
  {
    locale: 'en',
    siteName: 'Eslam Muatamed',
    tagline: PUBLIC_TAGLINE.en,
    availabilityStatus: 'Open to frontend opportunities',
    defaultMetaTitle: 'Eslam Muatamed',
    defaultMetaDescription:
      'Frontend engineer specializing in Vue.js and Nuxt.js, building fast, accessible, SEO-focused web interfaces.',
    ...ABOUT_COPY.en,
  },
  {
    locale: 'ar',
    siteName: 'إسلام معتمد',
    tagline: PUBLIC_TAGLINE.ar,
    availabilityStatus: 'متاح لفرص عمل في تطوير الواجهات الأمامية',
    defaultMetaTitle: 'إسلام معتمد',
    defaultMetaDescription:
      'مهندس واجهات أمامية متخصص في Vue.js و Nuxt.js، أبني واجهات ويب سريعة وسهلة الوصول ومهيأة لمحركات البحث.',
    ...ABOUT_COPY.ar,
  },
];
