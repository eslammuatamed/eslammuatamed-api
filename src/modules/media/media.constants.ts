// In-process image/PDF processing concurrency cap (doc 19 §6, Q3): at most this many uploads
// process concurrently per API instance; a further non-duplicate upload is rejected with
// 429 + Retry-After and never queued (a dedup hit returns before the cap and consumes no slot). Distinct from the 10/min per-user+IP upload rate throttle
// (`UploadUserIpThrottlerGuard`).
export const MAX_CONCURRENT_PROCESSING = 2;

// Retry-After hint (seconds) for a 429 from the concurrency cap. A slot frees the moment an
// in-flight job finishes (sub-second to a couple seconds), so a short retry fits; the governing
// spec mandates the header but does not pin the value — this is a chosen default.
export const PROCESSING_RETRY_AFTER_SECONDS = 2;

// Immutable, year-long cache supplied on every stored media object — `R2` persists it as object
// metadata; the local adapter ignores it and writes bytes only. Keys are randomized per upload and so
// are not reused in practice (doc 07 §6, doc 20 §4, doc 23 §1) — neither adapter uses create-only
// semantics, so this rests on UUID collision being negligible — and each object is safe to cache. Images
// (master + renditions) require it; the resume PDF carries it too (its key is equally immutable)
// alongside its Content-Disposition download header.
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

// Every object for one asset lives under a single randomized prefix (doc 07 §6, doc 19 §5): the
// prefix is server-generated per upload, so a duplicate-race loser's keys are disjoint from the
// winner's and cleanup does not touch another asset's objects — probabilistically, via randomUUID(). The sanitized original filename
// is never part of a key or public path (doc 19 §5).
export const MEDIA_KEY_ROOT = 'media';
