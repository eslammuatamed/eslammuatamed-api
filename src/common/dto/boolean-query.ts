/**
 * Coerce the two documented boolean tokens from a query string, and leave anything else untouched
 * so `@IsBoolean()` rejects it with a 422 — rather than silently treating garbage as `false`, which
 * is how a filter starts lying about what it filtered.
 *
 * `MessageListQueryDto` carries an identical private copy that predates this module; it can adopt
 * this one whenever that file is next touched for its own reasons. Extracting it here rather than
 * importing across module boundaries keeps `common/` the shared home it already is.
 */
export function toOptionalBoolean(value: unknown): unknown {
  if (value === 'true' || value === true) {
    return true;
  }
  if (value === 'false' || value === false) {
    return false;
  }
  return value;
}
