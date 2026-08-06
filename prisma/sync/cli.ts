// Entry point for the canonical content synchronization (doc 09 §6.2, D09-21).
//
//   npm run content:sync:plan    — dry-run. Reads, prints the plan, writes NOTHING.
//   npm run content:sync:apply   — builds the same plan and applies it in one transaction.
//
// The two commands are separate NAMES, not one command plus a flag or an environment variable.
// That is the safety mechanism: what a command does is legible at the call site, in the shell
// history and in a runbook, and cannot be changed by the environment it happens to inherit.
//
// Deliberately absent: `--force`. A flag that bypasses validation is a flag that gets used in a
// hurry, and the validation is the only thing standing between a mistyped dataset and production.
import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import {
  applyPlan,
  PlanRejectedError,
  TransactionConflictError,
} from './apply-plan';
import { buildPlan } from './build-plan';
import { readOnly } from './read-client';
import { renderPlan, renderPlanJson } from './report';
import { isNoOp, summarize } from './types';

type Mode = 'plan' | 'apply';

function parseArgs(argv: readonly string[]): {
  mode: Mode;
  json: boolean;
  verbose: boolean;
} {
  const args = argv.slice(2);
  const mode: Mode = args.includes('--apply') ? 'apply' : 'plan';
  const unknown = args.filter(
    (arg) => !['--apply', '--json', '--verbose'].includes(arg),
  );
  if (unknown.length)
    throw new Error(
      `Unknown option(s): ${unknown.join(', ')}. Supported: --apply, --json, --verbose. ` +
        `There is no --force (doc 09 §6.2).`,
    );
  return {
    mode,
    json: args.includes('--json'),
    verbose: args.includes('--verbose'),
  };
}

async function main(): Promise<void> {
  const { mode, json, verbose } = parseArgs(process.argv);
  const prisma = new PrismaClient();

  try {
    // `readOnly` narrows the client so the builder CANNOT write — the dry-run's zero-write
    // guarantee is enforced by the type system, not by reviewer attention.
    const plan = await buildPlan(readOnly(prisma));

    if (mode === 'plan') {
      process.stdout.write(
        json
          ? `${renderPlanJson(plan)}\n`
          : `${renderPlan(plan, { verbose })}\n`,
      );
      // Non-zero on an unusable plan so a pipeline stops here rather than proceeding to apply.
      process.exitCode = plan.problems.length ? 2 : 0;
      return;
    }

    if (plan.problems.length) {
      process.stderr.write(`${renderPlan(plan, { verbose })}\n`);
      process.stderr.write(
        '\nRefusing to apply: the plan reports problems (see above).\n',
      );
      process.exitCode = 2;
      return;
    }

    if (isNoOp(plan)) {
      process.stdout.write(
        'No changes — the database already matches the canonical dataset. Nothing applied.\n',
      );
      return;
    }

    process.stdout.write(`${renderPlan(plan, { verbose })}\n\nApplying…\n`);
    const result = await applyPlan(prisma, plan);
    const summary = summarize(plan);
    process.stdout.write(
      `\nApplied: ${result.applied.creates} created · ${result.applied.updates} updated · ` +
        `${result.applied.deletes} deleted · ${result.applied.hides} hidden · ` +
        `${result.applied.relationAdditions} relation(s) added · ` +
        `${result.applied.relationRemovals} relation(s) removed.\n` +
        `Affected models: ${summary.affectedModels.join(', ')}\n` +
        `Operational record counts verified unchanged across ` +
        `${Object.keys(result.protectedCountsAfter).length} protected models.\n\n` +
        `Now run \`npm run content:sync:plan\` again — it must report NO changes (doc 09 §6.2).\n`,
    );
  } catch (error) {
    if (error instanceof PlanRejectedError) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 2;
      return;
    }
    // A rolled-back conflict is not a crash: the operator needs the actionable message, not a
    // Prisma stack trace, in the middle of a release.
    if (error instanceof TransactionConflictError) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 3;
      return;
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Canonical content synchronization failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
