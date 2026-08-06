// The read-only client surface handed to the plan builder (doc 09 §6.2).
//
// The dry-run's "zero writes" guarantee is a TYPE, not a policy. `buildPlan` accepts only this
// surface, which exposes `findMany` and `count` and nothing else — so `db.project.deleteMany(...)`
// inside the builder is a compile error rather than something a reviewer has to notice. A runtime
// interceptor still guards it in the tests (`content-sync.e2e-spec.ts`), because a type is erased
// at runtime and the guarantee is worth proving twice.
import type { PrismaClient } from '@prisma/client';

type ReadDelegate<D extends { findMany: unknown; count: unknown }> = Pick<
  D,
  'findMany' | 'count'
>;

export interface ReadOnlyDb {
  readonly locale: ReadDelegate<PrismaClient['locale']>;
  readonly skill: ReadDelegate<PrismaClient['skill']>;
  readonly project: ReadDelegate<PrismaClient['project']>;
  readonly experience: ReadDelegate<PrismaClient['experience']>;
  readonly category: ReadDelegate<PrismaClient['category']>;
  readonly tag: ReadDelegate<PrismaClient['tag']>;
  readonly article: ReadDelegate<PrismaClient['article']>;
  readonly siteSettings: ReadDelegate<PrismaClient['siteSettings']>;

  // Protected models — counted before and after the run so their preservation is verified rather
  // than asserted. Read access only; nothing here is ever written.
  readonly user: ReadDelegate<PrismaClient['user']>;
  readonly role: ReadDelegate<PrismaClient['role']>;
  readonly rolePermission: ReadDelegate<PrismaClient['rolePermission']>;
  readonly refreshToken: ReadDelegate<PrismaClient['refreshToken']>;
  readonly contactMessage: ReadDelegate<PrismaClient['contactMessage']>;
  readonly mediaAsset: ReadDelegate<PrismaClient['mediaAsset']>;
  readonly mediaAssetAlt: ReadDelegate<PrismaClient['mediaAssetAlt']>;
  readonly mediaAssetVariant: ReadDelegate<PrismaClient['mediaAssetVariant']>;
  readonly testimonial: ReadDelegate<PrismaClient['testimonial']>;
  readonly testimonialTranslation: ReadDelegate<
    PrismaClient['testimonialTranslation']
  >;
  readonly pageSeo: ReadDelegate<PrismaClient['pageSeo']>;
  readonly slugRedirect: ReadDelegate<PrismaClient['slugRedirect']>;
}

/**
 * Narrow a full client to the read-only surface. This is a widening-to-narrowing cast in the safe
 * direction — the returned value IS the client, but no caller can reach a write method through the
 * returned type.
 */
export function readOnly(prisma: PrismaClient): ReadOnlyDb {
  return prisma;
}
