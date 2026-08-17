/**
 * The static-page SEO key set (D09-24, FR-DSH-051).
 *
 * ── WHY THIS IS AN ENUMERATION AND NOT A FREE STRING ────────────────────────────────────────────
 *
 * `PageSeo` is keyed `(pageKey, locale)`, and `pageKey` is a plain TEXT column — the database will
 * accept anything. If the API accepted anything too, the Dashboard could create SEO rows for routes
 * that do not exist, and nothing would ever surface them: the public read is looked up BY key from a
 * page that already knows its own key, so an orphan row is unreachable rather than merely unused.
 * It would also hold a `RESTRICT` reference on its OG image forever, blocking deletion of an asset
 * for a page nobody can visit.
 *
 * So the set is closed here, in code, and an unknown key is a 404 on read and a 422 on write.
 *
 * ── WHERE THE SET COMES FROM ────────────────────────────────────────────────────────────────────
 *
 * The static public routes of doc 04 §1, i.e. every route whose metadata has no entity behind it.
 * Detail routes (`/projects/{slug}`, `/blog/{slug}`) are deliberately absent: their SEO lives on the
 * entity translation (FR-DSH-050, D09-4), and duplicating them here would create two sources for one
 * page's metadata. `/projects` and `/blog` appear as the INDEX pages, which have no entity.
 *
 * `/uses` is deliberately absent: D24-7 defers the route outright ("priority C… has no API or
 * dashboard module"), and a key for an unrouted page is exactly the orphan this list exists to
 * prevent. Adding `/uses` later means adding it here — one line, with the route.
 *
 * No document enumerated this set before D09-24; it was verified absent across every branch of the
 * docs repository and across `prisma/` before being written down, so this is the definition rather
 * than a copy of one.
 */
export const PAGE_SEO_KEYS = [
  'home',
  'about',
  'experience',
  'projects',
  'blog',
  'resume',
  'contact',
] as const;

export type PageSeoKey = (typeof PAGE_SEO_KEYS)[number];

const PAGE_SEO_KEY_SET: ReadonlySet<string> = new Set(PAGE_SEO_KEYS);

export function isPageSeoKey(value: string): value is PageSeoKey {
  return PAGE_SEO_KEY_SET.has(value);
}
