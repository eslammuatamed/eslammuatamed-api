import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260721120000_localize_availability_status/migration.sql',
);

describe('availability localization migration', () => {
  it('applies the final schema directly without a base-value copy', () => {
    const migration = readFileSync(migrationPath, 'utf8').replace(
      /^--.*$/gm,
      '',
    );

    expect(migration).toContain(
      'ALTER TABLE "site_settings_translations" ADD COLUMN "availability_status" TEXT;',
    );
    expect(migration).toContain(
      'ALTER TABLE "site_settings" DROP COLUMN "availability_status";',
    );
    expect(migration).not.toMatch(/\bUPDATE\b/i);
  });
});
