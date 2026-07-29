import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { createE2eApp } from './utils/e2e-app';

// Migrated-database invariant guard for the raw-SQL FTS objects (D09-6, D02-3).
//
// The companion `scripts/check-fts-migration-safety.mjs` reads committed migration *text*; this
// suite proves the *replayed database* still has the objects. Text and catalog are checked
// separately on purpose: a migration could be textually clean and still leave the wrong shape
// (e.g. an ordinary tsvector column with a DEFAULT instead of a stored generated column, which
// is exactly what the Prisma schema representation cannot distinguish).
describe('FTS invariants (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps search_vector as a STORED generated tsvector column', async () => {
    const [column] = await prisma.$queryRawUnsafe<
      { data_type: string; generated: string }[]
    >(`
      SELECT format_type(a.atttypid, a.atttypmod) AS data_type,
             a.attgenerated::text                 AS generated
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'article_translations'
        AND a.attname = 'search_vector'
        AND NOT a.attisdropped
    `);

    expect(column).toBeDefined();
    expect(column?.data_type).toBe('tsvector');
    // 's' = STORED. An empty string would mean an ordinary column — i.e. generation was lost.
    expect(column?.generated).toBe('s');
  });

  it('keeps the locale-sensitive generation expression', async () => {
    const [row] = await prisma.$queryRawUnsafe<
      { expression: string | null }[]
    >(`
      SELECT pg_get_expr(d.adbin, d.adrelid) AS expression
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE c.relname = 'article_translations' AND a.attname = 'search_vector'
    `);

    const expression = (row?.expression ?? '').replace(/\s+/g, ' ');
    expect(expression).toContain('to_tsvector');
    // Arabic uses `simple` (no stemmer); everything else uses `english` (D09-6).
    expect(expression).toContain("'simple'::regconfig");
    expect(expression).toContain("'english'::regconfig");
    expect(expression).toContain('title');
    expect(expression).toContain('excerpt');
  });

  it('keeps the GIN index targeting search_vector', async () => {
    const [index] = await prisma.$queryRawUnsafe<{ indexdef: string }[]>(`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'article_translations'
        AND indexname = 'article_translations_search_vector_idx'
    `);

    expect(index).toBeDefined();
    expect(index?.indexdef).toContain('USING gin');
    expect(index?.indexdef).toContain('search_vector');
  });

  it('populates the generated column on insert', async () => {
    const category = await prisma.category.findFirst({ select: { id: true } });
    expect(category).toBeTruthy();

    const article = await prisma.article.create({
      data: {
        status: 'DRAFT',
        categoryId: category!.id,
        translations: {
          create: {
            locale: 'en',
            title: 'Generated column probe',
            slug: `fts-invariant-probe-${Date.now()}`,
            excerpt: 'Indexable excerpt',
            body: 'body',
            readingTimeMin: 1,
          },
        },
      },
      include: { translations: true },
    });

    try {
      const [row] = await prisma.$queryRawUnsafe<{ sv: string | null }[]>(
        'SELECT search_vector::text AS sv FROM article_translations WHERE id = $1',
        article.translations[0]!.id,
      );
      // Written by the database, never by the application: proof the column is still generated.
      expect(row?.sv).toBeTruthy();
      expect(row?.sv).toContain('probe');
    } finally {
      await prisma.article.delete({ where: { id: article.id } });
    }
  });
});
