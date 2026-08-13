import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Builds a Prisma Client for code that runs OUTSIDE the NestJS application —
 * seeds, CLI scripts and tests.
 *
 * Inside the application there is exactly one way to reach the database:
 * inject `PrismaService`. This factory exists because a seed script has no Nest
 * container to inject from, not because there is a second architecture.
 *
 * Prisma 7 requires a driver adapter at every client construction, so this keeps
 * that one line in one place instead of repeating it in a dozen scripts.
 *
 * @param connectionString Defaults to `DATABASE_URL`. Tests pass an explicit URL
 *   so each run targets its own scratch database.
 */
export function createPrismaClient(connectionString?: string): PrismaClient {
  const url = connectionString ?? process.env.DATABASE_URL;

  if (url === undefined || url === '') {
    throw new Error(
      'createPrismaClient: no connection string. Pass one explicitly or set DATABASE_URL.',
    );
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}
