import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalesService } from '../locales/locales.service';

// Stored SlugRedirect.entityType values (OQ default, pinned). Each website section maps to one of
// these; the buildRedirectOps callers (articles/projects, T7) pass the matching literal.
export type RedirectEntityType = 'article' | 'project';

// Website section → entityType (D10-7 grammar). These are the front-end's paths (/blog, /projects),
// independent of the API's own /articles route; the section is preserved when composing toPath.
const SECTION_ENTITY_TYPES = {
  blog: 'article',
  projects: 'project',
} as const satisfies Record<string, RedirectEntityType>;

type RedirectSection = keyof typeof SECTION_ENTITY_TYPES;

// Section-relative path grammar: /{section}/{slug} (the front-end strips the /ar prefix, doc 04 §2).
const RESOLVE_PATH_PATTERN = /^\/([^/]+)\/([^/]+)$/;

@Injectable()
export class RedirectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locales: LocalesService,
  ) {}

  async resolve(
    locale: string,
    path: string,
  ): Promise<{ toPath: string } | null> {
    // Unknown/disabled locale → 400, never a silent cross-locale fallback (D10-6).
    await this.locales.assertEnabled(locale);

    const match = RESOLVE_PATH_PATTERN.exec(path);
    const section = match?.[1];
    const fromSlug = match?.[2];
    if (section === undefined || fromSlug === undefined) return null;
    if (!isKnownSection(section)) return null;

    // One hop only (D10-7): a single lookup on the @@unique([locale, entityType, fromSlug]) key,
    // never a transitive walk on the resolved slug.
    const record = await this.prisma.slugRedirect.findUnique({
      where: {
        locale_entityType_fromSlug: {
          locale,
          entityType: SECTION_ENTITY_TYPES[section],
          fromSlug,
        },
      },
    });
    if (!record) return null;

    return { toPath: `/${section}/${record.toSlug}` };
  }

  // D04-6: the 3-step recipe articles/projects push into their own $transaction (T7), so the
  // redirect and the slug rename commit atomically. Returns the ops in transaction order; the
  // caller executes them — this method never runs them itself.
  buildRedirectOps(args: {
    locale: string;
    entityType: RedirectEntityType;
    oldSlug: string;
    newSlug: string;
  }): Prisma.PrismaPromise<unknown>[] {
    const { locale, entityType, oldSlug, newSlug } = args;
    return [
      // 1. Collapse chains — repoint any redirect that targeted the now-vacated old slug, so every
      //    redirect stays one hop to the current live slug (no a→b→c chain).
      this.prisma.slugRedirect.updateMany({
        where: { locale, entityType, toSlug: oldSlug },
        data: { toSlug: newSlug },
      }),
      // 2. Clear stale source — the new slug is now live, so it must not also be a redirect source
      //    (keeps rename-back and slug-reuse safe).
      this.prisma.slugRedirect.deleteMany({
        where: { locale, entityType, fromSlug: newSlug },
      }),
      // 3. Record the old→new redirect.
      this.prisma.slugRedirect.create({
        data: { locale, entityType, fromSlug: oldSlug, toSlug: newSlug },
      }),
    ];
  }
}

function isKnownSection(section: string): section is RedirectSection {
  return Object.prototype.hasOwnProperty.call(SECTION_ENTITY_TYPES, section);
}
