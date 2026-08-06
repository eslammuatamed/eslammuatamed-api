#!/usr/bin/env node
// Migration-text guard for the raw-SQL full-text-search objects (D09-6, D02-3).
//
// `article_translations.search_vector` is a PostgreSQL `GENERATED ALWAYS AS (...) STORED`
// column with a GIN index. Prisma cannot express a stored generated column, so
// `prisma migrate dev` has historically emitted `DROP INDEX` + `DROP COLUMN` for it on every
// run. Committing that output silently deletes article search.
//
// This guard scans every migration committed AFTER the one that creates those objects and
// fails on statements that would drop, retype, or de-generate them.
//
// There is deliberately NO environment-variable or comment bypass. A legitimate removal or
// redesign must add the migration's directory name to APPROVED_FTS_CHANGES below — a visible
// code change, reviewable in the PR, and requiring a Docs-first decision first.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations');
const PROTECTED_COLUMN = 'search_vector';
const PROTECTED_INDEX = 'article_translations_search_vector_idx';

// Migrations explicitly approved to change the protected objects. Adding an entry requires a
// recorded decision in ../eslammuatamed-docs (doc 09) — never add one to make CI pass.
const APPROVED_FTS_CHANGES = new Set();

// Each rule is checked against SQL with comments stripped, so a rule can never be defeated by
// mentioning the statement inside a `--` note (this file's own migrations do exactly that).
const FORBIDDEN = [
  {
    name: 'DROP COLUMN search_vector',
    re: /\bDROP\s+COLUMN\s+(IF\s+EXISTS\s+)?"?search_vector"?/i,
  },
  {
    name: 'DROP INDEX on the FTS GIN index',
    re: new RegExp(`\\bDROP\\s+INDEX\\s+(IF\\s+EXISTS\\s+)?"?${PROTECTED_INDEX}"?`, 'i'),
  },
  {
    name: 'ALTER COLUMN search_vector TYPE (retype)',
    re: /\bALTER\s+COLUMN\s+"?search_vector"?\s+(SET\s+DATA\s+)?TYPE\b/i,
  },
  {
    name: 'DROP EXPRESSION on search_vector (de-generates the column)',
    re: /\bALTER\s+COLUMN\s+"?search_vector"?\s+DROP\s+EXPRESSION\b/i,
  },
  {
    // PostgreSQL rejects these on a generated column, so committing one breaks the chain.
    name: 'SET/DROP DEFAULT on search_vector',
    re: /\bALTER\s+COLUMN\s+"?search_vector"?\s+(SET|DROP)\s+DEFAULT\b/i,
  },
];

function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

function migrationDirs() {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(); // timestamp-prefixed, so lexicographic order is chronological
}

function main() {
  const dirs = migrationDirs();
  const sqlByDir = new Map(
    dirs.map((dir) => [
      dir,
      stripSqlComments(readFileSync(join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8')),
    ]),
  );

  // The baseline is the first migration that creates the generated column.
  const baseline = dirs.find((dir) => {
    const sql = sqlByDir.get(dir);
    return sql.includes(PROTECTED_COLUMN) && /GENERATED\s+ALWAYS\s+AS/i.test(sql);
  });

  if (!baseline) {
    console.error(
      `✖ FTS guard: no migration creates a GENERATED ALWAYS column named "${PROTECTED_COLUMN}".\n` +
        '  The protected object is missing from the migration chain entirely.',
    );
    process.exit(1);
  }

  const violations = [];
  for (const dir of dirs.slice(dirs.indexOf(baseline) + 1)) {
    if (APPROVED_FTS_CHANGES.has(dir)) continue;
    const sql = sqlByDir.get(dir);
    for (const rule of FORBIDDEN) {
      if (rule.re.test(sql)) violations.push({ dir, rule: rule.name });
    }
  }

  if (violations.length > 0) {
    console.error('✖ FTS guard: protected full-text-search objects would be destroyed.\n');
    for (const violation of violations) {
      console.error(`  ${violation.dir}\n    → ${violation.rule}`);
    }
    console.error(
      '\n  `article_translations.search_vector` (D09-6) backs article search (D02-3).\n' +
        '  Prisma cannot model a stored generated column, so `prisma migrate dev` emits these\n' +
        '  statements as drift. Review generated SQL with `--create-only` and delete them.\n' +
        '  An intentional redesign requires a Docs-first decision, then an explicit entry in\n' +
        '  APPROVED_FTS_CHANGES in this file.',
    );
    process.exit(1);
  }

  console.log(
    `✓ FTS guard: ${dirs.length - dirs.indexOf(baseline) - 1} migration(s) after ` +
      `${baseline} leave "${PROTECTED_COLUMN}" and its GIN index intact.`,
  );
}

main();
