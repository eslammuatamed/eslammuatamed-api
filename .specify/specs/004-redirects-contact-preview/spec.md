# Feature 004 — Redirects, Contact & Preview Tokens (API)

**Feature Branch:** `feature/004-redirects-contact-preview` (git) · spec dir `004-redirects-contact-preview`
**Milestone:** M2 — API Complete (doc 24 §2). **Status:** 📝 **Planned** — owner scope approved 2026-07-20 (two material decisions resolved: preview-token minting = dedicated per-type endpoints; slug-redirect population = auto-on-published-rename). `plan.md` + `tasks.md` authored, advisor- and critic-reviewed; all OQ defaults (OQ-5 grammar, OQ-6 anti-spam, `entityType` values) **pinned in `plan.md`** — no open clarifications. Ready for the T1 doc-first gate → implementation.
**Base:** API `dev` @ `40a0c91`. **API-only.** No Web/Docs implementation beyond the required doc-first amendments.
**Governing docs:** 01 §2/§7, 02 §3/§4 (FR-PUB-005/017/050/051/052/053, FR-DSH-060, D02-1/D02-4), 04 §1/§2/§6/§7 (D04-1/2/3, **new D04-6**), 05 §3 (F-D2, F-D5, F-D6), 07 §2/§3, 09 §3/§5 (`SlugRedirect`, `ContactMessage`), 10 §5/§6/§9 (D10-3/5/7/8, **new D10-11**), 15, 16 §3, 19 §3/§6/§7/§8 (D19-7).
**Requirements carried:** FR-PUB-050 (contact form fields + validation), FR-PUB-051 (honeypot + time-trap + rate limit, no CAPTCHA), FR-PUB-052 (submission stored + visible in inbox), FR-PUB-053 (success/failure feedback + email fallback — API side), FR-DSH-060 (inbox: list, read/unread, archive; no reply-from-dashboard), plus D10-7 (redirect resolve), D04-3/**D04-6** (auto-301 on published-slug rename), D10-8/D19-7 (HMAC preview tokens), **D10-11** (dedicated per-type preview-token mint endpoints).

---

## Problem

M1/M2 shipped the content schema ahead of three modules that doc 07 §2 names but `main` does not yet have (`src/modules/README.md` lists `redirects`, `contact`, and preview tokens as **Planned — Feature 004**):

1. **Redirects.** The `slug_redirects` table, the `redirects.*` permission keys, and decisions D04-3/D10-7 all exist, but nothing **populates** the table (a published-slug rename leaves the old URL dead — the doc 01 §2 staleness failure) and nothing **serves** it (no `/redirects/resolve`, so the web app's 404 recovery has nowhere to look). URL death is an SEO and P1-trust failure (doc 04 §2).
2. **Contact.** The `contact_messages` table, the `messages.*` keys, and decisions D02-1/D02-4 exist, but there is **no intake endpoint** (the platform's single conversion point, FR-PUB-052/D05-4) and **no inbox** (FR-DSH-060). The persona cannot reach the operator through the platform.
3. **Preview tokens.** `PREVIEW_TOKEN_SECRET` is boot-validated and doc 19 §8/D19-7 defines the HMAC token, but there is **no way to mint a token** (the dashboard cannot compute the API-only HMAC) and **no consuming route** — so drafts cannot be previewed at all (F-D2), yet must never leak publicly (FR-PUB-046).

Feature 004 builds the three modules over the **existing schema** — **no new tables, no migration** — completing the doc 10 §5 catalog's public surface for the M2 gate and the inbox/preview surfaces the M3 dashboard will consume.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A visitor reaches the operator through the contact form (Priority: P1)

A site visitor (persona P1/P3) fills the contact form (name, email, subject, message) and submits. The message is stored and becomes visible to the operator in the dashboard inbox; the visitor gets clear success feedback. Automated spam is turned away without friction to the human, and abusive volume is rate-limited.

**Why this priority**: Contact is the platform's single conversion point (D05-4). Without it the site cannot do its primary job. It is independently valuable and testable with no dependency on the other two stories.

**Independent Test**: `POST /contact` with a valid body persists a `ContactMessage` and returns 2xx; the operator lists it in the inbox unread-first; a honeypot-filled / too-fast submission is silently dropped; a 4th submission in an hour is rejected.

**Acceptance Scenarios**:

1. **Given** a valid name/email/subject/message and an empty honeypot after the minimum fill time, **When** `POST /contact`, **Then** a `ContactMessage` is persisted (with UA/referrer in `meta`) and a 2xx envelope is returned.
2. **Given** an invalid body (missing field, malformed email), **When** `POST /contact`, **Then** `422` with `errors[]` (D10-5) and nothing is persisted.
3. **Given** the honeypot field is filled **or** the submission arrives before the minimum fill time, **When** `POST /contact`, **Then** the API returns a success-shaped 2xx **but persists nothing** (no signal to the bot).
4. **Given** 3 submissions from one IP within the hour, **When** a 4th arrives, **Then** `429` + `Retry-After` (doc 19 §6); likewise past 10/day.
5. **Given** stored messages, **When** the operator calls `GET /admin/messages`, **Then** they are returned unread-first, paginated, filterable by `isRead`/`isArchived`; `GET /admin/messages/{id}` returns one; `PATCH /admin/messages/{id}` toggles read/archive. No reply is sent from the API (D02-4).

### User Story 2 — A renamed published entry keeps its old URL alive (Priority: P2)

The operator renames the slug of a **published** article or project. The old public URL continues to work by resolving to the new location, so inbound links and search results do not die.

**Why this priority**: Realizes the documented D04-3 promise and protects earned SEO/trust. Depends on the existing articles/projects update paths but is independently testable.

**Independent Test**: Update a published article's `en` slug from `a` to `b`; a `SlugRedirect(en, article, a, b)` row appears (written in the same transaction); `GET /redirects/resolve?locale=en&path=/blog/a` returns `{ data: { toPath: "/blog/b" } }`; renaming a **draft** entry creates no row.

**Acceptance Scenarios**:

1. **Given** a **published** article whose `en` slug changes `a→b`, **When** the update commits, **Then** exactly one `SlugRedirect(locale=en, entityType=article, fromSlug=a, toSlug=b)` exists, created in the **same DB transaction** as the slug change.
2. **Given** a **published** project whose slug changes, **When** the update commits, **Then** one `SlugRedirect(entityType=project, …)` exists per changed locale.
3. **Given** a **draft/unpublished** entry, or an update where the slug is unchanged (`fromSlug === toSlug`), **When** the update commits, **Then** **no** redirect is created.
4. **Given** a redirect `a→b`, **When** `GET /redirects/resolve?locale=en&path=/blog/a`, **Then** `{ data: { toPath: "/blog/b" } }`; **When** no record matches, **Then** `404` `problem+json` (D10-7). The API never issues a 3xx (the web app issues the real 301, doc 06 §6).
5. **Given** a rename `a→b` followed by `b→a`, **When** the second update commits, **Then** no self-referential or looping redirect is stored (loop/self-redirect prevented).

### User Story 3 — The operator previews an unpublished draft via a shareable link (Priority: P3)

From the dashboard the operator obtains a short-lived preview link for a draft article or project and opens it (or shares it with a reviewer) in a clean browser with no login. The draft renders; the link stops working after 30 minutes and grants access to that one entity only. The draft is never reachable through normal public URLs.

**Why this priority**: Enables the F-D2 authoring loop and de-risks publishing, but is the least load-bearing of the three for the M2 public gate. Depends on the existing articles/projects read shapes.

**Independent Test**: `POST /admin/articles/{id}/preview-token` (with `articles.update`) returns `{ token, url, expiresAt }` and `no-store`, where `url` is the fetchable API path `/api/v1/preview/articles/{id}?token=…`; `GET {url}&locale=en` returns the draft with `no-store`; the same token on the projects route or another id → `404`; after 30 min → `404`; the draft stays `404` on the public article route.

**Acceptance Scenarios**:

1. **Given** an authenticated user with `articles.update`, **When** `POST /admin/articles/{id}/preview-token`, **Then** `2xx { data: { token, url, expiresAt } }`, `Cache-Control: no-store`, `url` = the fetchable API path `/api/v1/preview/articles/{id}?token=…` (the JSON endpoint the web fetches; the human-shareable rendered link is built web-side from `token` — see Assumptions); token value is never logged. Same for projects with `projects.update`.
2. **Given** no token / wrong permission, **When** the mint endpoint is called, **Then** `401` (unauthenticated) / `403` (authenticated without the type-specific update permission).
3. **Given** a valid unexpired token for article X, **When** `GET /preview/articles/{id}?token=…`, **Then** the **draft** entity is returned with `Cache-Control: no-store`.
4. **Given** an expired (>30 min), tampered, absent, wrong-entity, or wrong-type token, **When** the preview route is called, **Then** `404` (draft invisibility preserved, FR-PUB-046) — never a 401/403 that would confirm existence.
5. **Given** an unpublished draft, **When** it is requested via the normal public slug route `/blog/{slug}`, **Then** `404` regardless of any preview token.

### Edge cases

- Contact body at the field-length ceilings; unicode name/subject; `meta` capture when UA/referrer headers are absent (empty-object default).
- Redirect resolve for a path with no section match, a path that is not a known section (`/blog` vs `/projects`), and Arabic paths (locale `ar`); a chain `a→b` then `b→c` (resolve returns the direct stored target, not a transitive walk — one hop, matching D10-7's "a lookup on 404").
- Rename touching multiple locales in one update → one redirect per changed locale; renaming back to a previously-redirected slug.
- Preview token minted for a since-published entity; token for a deleted entity; clock-skew at the 30-minute boundary.

## Scope (what ships)

1. **Redirects module + `RedirectService` (D10-7, D04-6).** A `redirects` module exposing an **exported** `RedirectService` with two responsibilities: **record** (create a `SlugRedirect` for a qualifying rename) and **resolve** (path → target). Public `GET /redirects/resolve?locale&path` → `{ data: { toPath } }` or `404` — **D10-7 contract unchanged**. The service maps the public path to `(entityType, fromSlug)` using the doc 04 §1/§2 route grammar (`/blog/{slug}` → `article`, `/projects/{slug}` → `project`; locale from the explicit `locale` param), looks up `SlugRedirect(locale, entityType, fromSlug)`, and composes `toPath` from the section + `toSlug`. Public read: `@Public()`, locale validated against enabled locales, cache headers per doc 10 §5.
2. **Auto-redirect on published rename (D04-6, realizes D04-3).** The exported `RedirectService` (record responsibility, implemented as `buildRedirectOps(...)` returning ops for the caller's transaction — see `plan.md`) is invoked from the **existing** `articles` and `projects` slug-update flows. When a locale-specific slug changes **and the old slug was publicly live and the new slug stays publicly live** (articles `existing.status===PUBLISHED && nextStatus===PUBLISHED`; projects `existing.isPublished && nextIsPublished`), a `SlugRedirect(locale, entityType, fromSlug, toSlug)` is written **in the same DB transaction** as the slug update (atomic — either both or neither). No redirect is written when the old slug was never public (draft/scheduled/archived, or a draft→publish+rename), the new slug isn't live (publish→unpublish+rename), the slug is **unchanged**, or `fromSlug === toSlug`. One redirect **per changed locale**. Self-redirects and loops are prevented (3-step recipe in `plan.md`). Integration avoids circular Nest module dependencies (articles/projects import the exported `RedirectService`, not vice-versa). **No `/admin/redirects` CRUD** in this feature.
3. **Contact intake (FR-PUB-050/051/052/053, D02-1).** Public `POST /contact` (`@Public()`) persists a `ContactMessage` (`name`, `email`, `subject`, `body`; `meta` JSONB = UA + referrer for spam forensics). A new **`contact` throttle** — **3/hour + 10/day per IP** (doc 19 §6) — enforced by a **route-local two-window throttler guard** (mirroring the shipped `upload-user-ip-throttler.guard.ts` precedent, IP-keyed; see `plan.md`), so the extra windows don't apply to other routes. **Anti-spam** (no CAPTCHA, D02-1): honeypot field **`website`** + minimum-fill-time trap **`elapsedMs`** (both request-only, never persisted, declared in the DTO but **permissively validated** so a tripped trap isn't rejected with a distinguishable 422); a filled honeypot or a sub-threshold submission returns a **success-shaped 2xx but persists nothing** (no signal to bots). The `website`/`elapsedMs` field names + threshold are a **shared web/API contract** (pinned in `plan.md`, so the web form matches). Validation: `@IsEmail` on email, length-capped whitelisted text fields (default body-parser limit — no bespoke JSON size cap needed for a contact form); `422` + `errors[]` on genuinely invalid input.
4. **Contact inbox (FR-DSH-060, D02-4).** Admin surface under `/admin/messages`, default-deny, each route `@RequirePermission('messages.<action>')`: `GET /admin/messages` (list, **unread-first**, paginated `{data, meta}`, filters `isRead`/`isArchived`, backed by the existing `(isArchived, isRead, createdAt)` index), `GET /admin/messages/{id}` (`messages.read`), `PATCH /admin/messages/{id}` (`messages.update` — toggle `isRead`/`isArchived`). **No `messages.create` endpoint** (messages are created only by the public intake). **No reply-from-dashboard** (D02-4). Admin throttle tier.
5. **Preview token utility (reuse D19-7/§8).** A small, well-tested HMAC utility reusing the **existing** doc 19 §8 format: `HMAC(PREVIEW_TOKEN_SECRET, entityType + entityId + exp)`, **30-minute** expiry, scoped to one entity. Wire format `base64url(exp).base64url(mac)`. `mint(entityType, id)` and `verify(entityType, id, token)` (constant-time compare, expiry check). Token values are **never logged**. No DB state (D19-7).
6. **Preview mint endpoints (D10-11 — new decision).** Dedicated per-type endpoints: `POST /admin/articles/{id}/preview-token` (`@RequirePermission('articles.update')`) and `POST /admin/projects/{id}/preview-token` (`@RequirePermission('projects.update')`) → `2xx { data: { token, url, expiresAt } }`, `Cache-Control: no-store`, where **`url` is the fetchable API consuming-route path** `/api/v1/preview/{articles|projects}/{id}?token=<token>` (the JSON endpoint the web fetches to render the draft; the human-shareable rendered link is built web-side from `token` — repo-independence, see Assumptions & `plan.md`). Tokens are **never** embedded in admin GET/list responses (no GET side effects).
7. **Preview consuming routes (D10-8).** `GET /preview/articles/{id}?token=` and `GET /preview/projects/{id}?token=` verify the token (recompute HMAC over `entityType+id+exp`, constant-time compare, exp not passed) and, if valid, return the **draft/unpublished** entity with `Cache-Control: no-store`. Any invalid/expired/tampered/absent/wrong-entity/wrong-type token → **`404`** (preserve draft invisibility, FR-PUB-046). These are the **only** way draft content is fetchable; normal public slug routes still `404` for drafts.
8. **Contract + quality rails.** Exhaustive `@nestjs/swagger` + `class-validator` decorators (with realistic examples) on every new DTO/entity; `route-permissions` metadata on every new admin route; `npm run contract:export` stays **DB-free and idempotent**; `openapi.json` re-exported (additive → minor bump, no `/api/v2`, D10-1); unit specs (Prisma mocked) + e2e per module with `jest-openapi` contract assertions.

## Functional requirements

- **FR-004-01** — `POST /contact` persists a valid submission and returns a 2xx envelope; invalid input → `422` with `errors[]`. (FR-PUB-050/052)
- **FR-004-02** — A honeypot-filled or sub-threshold-fill-time submission is accepted-shaped but not persisted; no distinguishable signal is returned. (FR-PUB-051, D02-1)
- **FR-004-03** — `POST /contact` is limited to 3/hour and 10/day per IP; excess → `429` + `Retry-After`. (doc 19 §6)
- **FR-004-04** — UA and referrer are captured into `ContactMessage.meta`; absent headers yield a safe default. (doc 09 §3)
- **FR-004-05** — `GET /admin/messages` returns messages unread-first, paginated, filterable by `isRead`/`isArchived`; `GET /admin/messages/{id}` returns one; `PATCH /admin/messages/{id}` toggles read/archive; all require the matching `messages.*` permission; no create/reply endpoint. (FR-DSH-060, D02-4)
- **FR-004-06** — Renaming a **published** article/project locale-slug creates exactly one `SlugRedirect(locale, entityType, fromSlug, toSlug)` per changed locale, atomically with the slug update. (D04-6)
- **FR-004-07** — No redirect is created for draft/unpublished entities, unchanged slugs, or `fromSlug === toSlug`; loops/self-redirects are prevented. (D04-6)
- **FR-004-08** — `GET /redirects/resolve?locale&path` returns `{ data: { toPath } }` for a matching record and `404` `problem+json` otherwise; the API never emits a 3xx. (D10-7)
- **FR-004-09** — `POST /admin/{articles,projects}/{id}/preview-token` returns `{ token, url, expiresAt }` with `no-store` to a caller holding the type-specific `*.update` permission; `401`/`403` otherwise; token never logged or embedded in admin reads. (D10-11)
- **FR-004-10** — `GET /preview/{articles,projects}/{id}?token=` returns the draft with `no-store` for a valid unexpired token; any invalid/expired/tampered/absent/wrong-entity/wrong-type token → `404`. (D10-8, D19-7, FR-PUB-046)
- **FR-004-11** — Draft entities remain `404` on normal public slug routes regardless of any preview token. (FR-PUB-046)
- **FR-004-12** — All new endpoints are contract-decorated; `openapi.json` re-exports additively (no removed paths/schemas/props); `contract:export` runs DB-free. (doc 10 §1, doc 16 §3, D10-1)

## Key entities (existing schema — no changes)

- **`SlugRedirect`** (`slug_redirects`): `id`, `locale` (FK `Locale.code`), `entityType`, `fromSlug`, `toSlug`, timestamps; `@@unique([locale, entityType, fromSlug])`. Populated by `RedirectService` (`buildRedirectOps`); read by resolve. `entityType` string values: **`article`**, **`project`** (**pinned**, `plan.md`).
- **`ContactMessage`** (`contact_messages`): `id`, `name`, `email`, `subject`, `body`, `isRead` (default false), `isArchived` (default false), `meta` JSONB (default `{}` — UA/referrer), timestamps; `@@index([isArchived, isRead, createdAt])`. Created by intake; read/updated by inbox.
- **Preview token** — *not persisted*. Stateless HMAC value (D19-7).

## Redirect path grammar (OQ-5 — resolved & pinned in plan.md)

Per doc 04 §1/§2: public section segments are Latin and stable in both locales; locale prefix is `prefix_except_default` (EN at root, AR under `/ar`). The `resolve` endpoint receives `locale` explicitly and `path` as the section-relative public path:

| Public section | `entityType` | `path` example (input) | `toPath` (output) |
| --- | --- | --- | --- |
| `/blog/{slug}` | `article` | `/blog/old-slug` | `/blog/new-slug` |
| `/projects/{slug}` | `project` | `/projects/old-slug` | `/projects/new-slug` |

A `path` with no known section, or with no matching redirect record, → `404`. Resolution is **one hop** (the stored `toSlug`), not a transitive chain (matches D10-7's "a lookup on 404").

## Anti-spam contract (OQ-6 — resolved & pinned in plan.md; shared with web)

- **Honeypot `website`:** a decoy field the real form keeps hidden/empty; any non-empty value ⇒ drop-as-success.
- **Time-trap `elapsedMs`:** the **client-computed elapsed milliseconds** between form render and submit (an elapsed duration, **not** an absolute timestamp — so a client with a skewed clock is never falsely dropped, D05-4); `elapsedMs < 3000` or absent/negative ⇒ drop-as-success.
- Both are **request-only** (never stored) and **declared in the DTO but permissively validated** (so `forbidNonWhitelisted` accepts them yet a tripped trap isn't rejected with a distinguishable 422). Field names + threshold documented as a shared web/API contract so the Nuxt form matches (D02-1).

## Doc-first amendments (constitution principle 1) — the T1 gate

Committed to the docs repo (feature branch off docs `main` @ `4045282`) **before any API code**, mirroring Feature 003's T1:

- **doc 04** (+**D04-6**, version bump): "Published slug renames automatically create `SlugRedirect` records" — the build commitment realizing D04-3 (published-only, per-locale, transactional, no manual CRUD, owned by `RedirectService`). Alternatives: resolve-only with deferred population; manual admin redirect CRUD.
- **doc 10** (+**D10-11**, version bump, catalog additions): "Dedicated per-type preview-token mint endpoints" (alternatives: generic mint endpoint; embedding tokens in admin reads; rationale: explicit resource authorization, one permission per guarded function, clean OpenAPI, no token leakage in ordinary admin reads, no GET side effects). §5 catalog gains `POST /admin/{articles,projects}/{id}/preview-token`, `GET /admin/messages`, `GET /admin/messages/{id}`; §6 wording notes redirects are auto-populated on qualifying published renames. **D10-7 resolve contract unchanged.**
- **doc 19** — **no new decision expected**; the preview mint reuses D19-7/§8 verbatim and mint authz is existing RBAC (§3). A one-line §8 note that tokens are minted via the D10-11 endpoints may be added (no ID).

*(Decision IDs verified against docs `main` 4045282: `D04-6` and `D10-11` are the next free IDs — the owner-suggested `D04-4`/`D10-10` were already taken.)*

## Acceptance criteria

- [ ] **Doc-first:** docs 04 (+D04-6) and 10 (+D10-11 + catalog) revised with decision-log entries + version bumps, committed **before** any API code; D10-7 unchanged.
- [ ] `POST /contact` persists a valid `ContactMessage` (UA/referrer in `meta`) → 2xx; invalid → 422 `errors[]`; honeypot/too-fast → 2xx-shaped, nothing persisted; 4th/hour and 11th/day → 429 + `Retry-After`.
- [ ] `GET /admin/messages` unread-first + paginated + `isRead`/`isArchived` filters; `GET /admin/messages/{id}`; `PATCH` toggles read/archive; 401 without token, 403 without `messages.*`; no create/reply route.
- [ ] Published article/project locale-slug rename → exactly one `SlugRedirect` per changed locale, written **atomically** (same transaction); draft/unchanged/self → none; loop/self-redirect prevented.
- [ ] `GET /redirects/resolve?locale&path` → `{ data: { toPath } }` on hit, `404` on miss; never a 3xx; locale validated; one-hop resolution.
- [ ] `POST /admin/{articles,projects}/{id}/preview-token` → `{ token, url, expiresAt }` + `no-store` for the type-specific `*.update` holder; 401/403 otherwise; token never logged/embedded in admin reads.
- [ ] `GET /preview/{articles,projects}/{id}?token=` → draft + `no-store` on a valid token; expired/tampered/absent/wrong-entity/wrong-type → 404; draft still 404 on `/blog/{slug}`.
- [ ] Preview token: valid on the matching type only (article token rejected on projects route and vice-versa); 30-min expiry enforced at the boundary; constant-time verify.
- [ ] Every new admin route in `route-permissions.spec`; e2e green with `jest-openapi`; `openapi.json` re-exported **additively** (0 removed paths/schemas/props, D10-1); `npm run lint && npx tsc --noEmit && npm test && npm run contract:export` green **with no database**.

## Owner-resolved decisions (2026-07-20)

- **Preview minting → dedicated per-type endpoints (→ doc 10 D10-11).** Chosen over a generic mint endpoint or embedding tokens in admin reads, for explicit resource authorization, one permission per guarded function, clean OpenAPI, and no token leakage in ordinary admin reads / no GET side effects.
- **Slug-redirect population → auto-on-published-rename (→ doc 04 D04-6).** Chosen over resolve-only-with-deferred-population or manual admin CRUD, to preserve old public URLs without editorial follow-up and realize D04-3. Accepted scope touch: the existing `articles`/`projects` slug-update flows call `RedirectService`.

## Assumptions

- `entityType` stored values are `article` / `project` (**pinned**); the public section→type map is `/blog`→`article`, `/projects`→`project` (doc 04 §1).
- Preview mint reuses the existing D19-7 token exactly; no format change.
- The mint **`url`** is the API consuming-route path (`/api/v1/preview/{type}/{id}?token=`) — the JSON endpoint the web fetches, per the owner's literal directive and repo-independence (the API never hard-codes a web page route). The human-shareable **rendered** reviewer link is built web-side from `token`. *(Owner-veto point: if an absolute web-origin page URL was intended, it's a trivial pre-adoption change since web adopts at M3/M4.)*
- Denial for bad/expired preview tokens is **404** (not 401/403) to preserve draft invisibility (FR-PUB-046).
- The `contact` throttle is IP-keyed (contrast the `/admin/media` user+IP key) per doc 19 §6.
- No new runtime dependency is required (Node `crypto` for HMAC; `@nestjs/throttler` already present).

## Out of scope (this feature)

- **`/admin/redirects` manual CRUD** — not in Feature 004 (owner: auto-on-rename only). Table is populated solely by `RedirectService.record`.
- **12-month archived-message purge job** — deferred to **Feature 005** (feature-map places retention/backup under 005; owner-confirmed).
- **New permissions** — reuse existing `redirects.*` (unused this feature beyond resolve being public), `messages.*`, `articles.update`, `projects.update`.
- **Web/Docs implementation** — beyond the required doc-first amendments (docs 04/10). The Nuxt contact form, 404 redirect handling, preview rendering, and inbox UI are web work (M3/M4); this feature ships the API contract only (doc 16 §3 adoption happens later).
- **`page_seo` / SEO module** — separate Planned module, not Feature 004.
- **Transitive redirect chains, redirect analytics, soft-404 handling** — not required by D10-7.

## Dependencies

- **Existing schema:** `slug_redirects`, `contact_messages` (present; no migration).
- **Existing config:** `PREVIEW_TOKEN_SECRET` (boot-validated).
- **Existing modules touched (additively):** `articles` + `projects` (slug-update flows call `RedirectService`); `access-control` permission keys (`messages.*`, `redirects.*`, `articles.update`, `projects.update` — already seeded).
- **Doc-first prerequisite:** docs 04/10 amendments merged/committed before code (T1 gate).

## Success criteria

- **SC-001** — A visitor can submit the contact form and the operator sees the message in the inbox, with zero human-facing anti-spam friction (no CAPTCHA); automated spam does not reach the inbox.
- **SC-002** — After a published entry is renamed, its old public URL still leads visitors to the current page (no dead link), with the redirect recorded automatically and no operator action.
- **SC-003** — The operator can share a draft-preview link that opens the draft in a clean browser and stops working within 30 minutes; the draft is never reachable through normal public URLs.
- **SC-004** — The public API surface for redirects and contact defined in the doc 10 §5 catalog is live and contract-asserted, advancing the M2 "full doc 10 catalog live" exit gate.
- **SC-005** — The API contract grows only additively (no breaking change to shipped `/api/v1` clients).

## Revisions

- **2026-07-20 (draft)** — Initial spec encoding the owner's two approved decisions (D10-11 dedicated preview-token mint; D04-6 auto-on-published-rename) and the stated defaults (OQ-2 admin message list/detail; OQ-5 path grammar; OQ-6 anti-spam contract; OQ-8 404 denial + base64url wire format; OQ-7 purge deferred to F005). Decision IDs renumbered vs owner suggestion after verifying docs `main` 4045282.
