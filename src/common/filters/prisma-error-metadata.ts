import { Prisma } from '../../generated/prisma/client';

// The ONE place that knows how Prisma reports a unique-constraint violation.
//
// Prisma has moved this information between major versions, and the two shapes disagree about
// vocabulary as well as location:
//
//   v6 (Rust query engine):  meta.target = ['locale', 'slug']            — Prisma field names
//   v7 (PrismaPg adapter):   meta.driverAdapterError.cause.constraint.fields
//                                        = ['category_id', 'locale']     — DATABASE column names
//
// Both are normalized to API field paths here so nothing outside this file has to know either
// shape exists. Services must never reach into `driverAdapterError` themselves.

/**
 * The driver-adapter metadata Prisma 7 attaches to a unique-constraint violation. Declared
 * structurally (not imported) because it is an implementation detail of the adapter, not part of
 * Prisma's public typed surface — a narrow guard is safer here than a cast.
 */
interface DriverAdapterConstraintMeta {
  readonly driverAdapterError: {
    readonly cause: {
      readonly constraint: {
        readonly fields: readonly string[];
      };
    };
  };
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasDriverAdapterConstraint(
  meta: unknown,
): meta is DriverAdapterConstraintMeta {
  if (!isRecord(meta)) return false;
  const adapterError = meta.driverAdapterError;
  if (!isRecord(adapterError)) return false;
  const cause = adapterError.cause;
  if (!isRecord(cause)) return false;
  const constraint = cause.constraint;
  if (!isRecord(constraint)) return false;
  return isStringArray(constraint.fields);
}

/**
 * `content_hash` → `contentHash`. Leaves an already-camelCase or single-word identifier untouched,
 * so it is safe to apply to both the v6 and v7 shapes.
 *
 * This is a purely mechanical translation, and it is only sound because the schema is mechanical:
 * every field participating in a unique constraint either carries a snake_case `@map` that is the
 * exact snake_case of its Prisma name, or carries no `@map` at all. That invariant is ENFORCED by
 * a test (`prisma-error-metadata.spec.ts`) rather than assumed — if someone adds a non-mechanical
 * `@map` to a unique field, that test fails and this helper needs an explicit exception entry.
 */
function toApiFieldName(databaseField: string): string {
  return databaseField.replace(/_([a-z0-9])/g, (_, char: string) =>
    char.toUpperCase(),
  );
}

/**
 * The API field paths that collided, or `null` when they cannot be determined reliably.
 *
 * `null` is deliberate and must stay distinguishable from `[]`: the caller answers it by omitting
 * `errors` entirely rather than inventing a placeholder. An API that reports `field: "unknown"` is
 * claiming to know something it does not.
 *
 * Field NAMES only — never a path. Prisma reports `slug`, so this returns `slug`; turning that
 * into `translations[0].slug` would be a guess about which DTO array element was responsible, and
 * this boundary has no access to the request body to make it.
 */
export function uniqueConstraintFields(
  error: Prisma.PrismaClientKnownRequestError,
): string[] | null {
  const { meta } = error;

  // Prisma 7 + driver adapter: database column names.
  if (hasDriverAdapterConstraint(meta)) {
    const fields = meta.driverAdapterError.cause.constraint.fields;
    return fields.length > 0 ? fields.map(toApiFieldName) : null;
  }

  // Legacy / documented shape, kept because it is cheap. Accepted ONLY as a string array:
  // Prisma also documents `target` as sometimes being a bare CONSTRAINT NAME
  // (`article_translations_locale_slug_key`), which is not a field and must never be published
  // as one. An ambiguous scalar is treated as "unknown" and drops the field paths.
  if (isRecord(meta) && isStringArray(meta.target) && meta.target.length > 0) {
    return meta.target.map(toApiFieldName);
  }

  return null;
}
