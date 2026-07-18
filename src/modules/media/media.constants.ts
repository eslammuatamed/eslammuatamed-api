// In-process image/PDF processing concurrency cap (doc 19 §6, Q3): at most this many uploads
// process concurrently per API instance; a further in-flight upload is rejected with 429 +
// Retry-After and never queued. Distinct from the 10/min per-user+IP upload rate throttle (T8).
export const MAX_CONCURRENT_PROCESSING = 2;

// Retry-After hint (seconds) for a 429 from the concurrency cap. A slot frees the moment an
// in-flight job finishes (sub-second to a couple seconds), so a short retry fits; the governing
// spec mandates the header but does not pin the value — this is a chosen default.
export const PROCESSING_RETRY_AFTER_SECONDS = 2;

// Immutable, year-long cache for every stored media object. Keys are randomized and never
// overwritten (doc 07 §6, doc 20 §4, doc 23 §1), so each object is safe to cache forever. Images
// (master + renditions) require it; the resume PDF carries it too (its key is equally immutable)
// alongside its Content-Disposition download header.
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

// Every object for one asset lives under a single randomized prefix (doc 07 §6, doc 19 §5): the
// prefix is server-generated per upload, so a duplicate-race loser's keys are always disjoint from
// the winner's and cleanup can never touch another asset's objects. The sanitized original filename
// is never part of a key or public path (doc 19 §5).
export const MEDIA_KEY_ROOT = 'media';
