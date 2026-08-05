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

// Real owner links (HR-8, owner-profile §8): GitHub grounded in the actual repo host, canonical
// LinkedIn (R7), canonical contact email (R5 — the "muatemed" spelling is intentional, not a typo,
// and is NOT the same address as `contactEmail` below). X/Twitter is omitted: the profile lists no
// handle and one must not be invented.
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
    url: 'mailto:eslammuatemed@gmail.com',
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
  contactEmail: 'contact@eslammuatamed.com',
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
