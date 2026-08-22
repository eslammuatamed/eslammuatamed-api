import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// Integration regression for the deploy summary's checkout-failure fallback.
//
// The classifier itself lives in scripts/deploy/deploy-summary.sh and is covered by
// deploy-summary.spec.ts — but that helper is a REPOSITORY FILE. The workflow checks
// out the repository first, so if checkout fails the helper does not exist, while the
// summary step still runs (`if: always()`). A naive `bash scripts/…` would make the
// summariser itself fail exactly when the run failed earliest, producing no truthful
// summary at all.
//
// These tests parse the REAL workflow file and pin the integration contract:
//   1. the checkout step carries the stable id `checkout`;
//   2. the always() summary step receives steps.checkout.outcome;
//   3. the summary branches on that outcome BEFORE any reference to scripts/, with an
//      inline fallback that needs no repository file;
//   4. only the checkout-succeeded branch invokes the real classifier;
//   5. executing the extracted fallback from an empty directory still renders a
//      truthful summary (proven by running it, not by grepping).

interface WorkflowStep {
  id?: string;
  name?: string;
  uses?: string;
  ['if']?: string;
  env?: Record<string, string>;
  run?: string;
}

interface DeployWorkflow {
  jobs: Record<string, { steps: WorkflowStep[] }>;
}

const WORKFLOW_PATH = path.join(
  __dirname,
  '..',
  '..',
  '.github',
  'workflows',
  'deploy.yml',
);

function loadDeployJobSteps(): WorkflowStep[] {
  // js-yaml is a declared devDependency (package.json); v4+ exposes `load`.
  const requireFromRepo = createRequire(__filename);
  const jsYaml = requireFromRepo('js-yaml') as {
    load: (text: string) => DeployWorkflow;
  };
  const doc = jsYaml.load(fs.readFileSync(WORKFLOW_PATH, 'utf8'));
  const deployJob = doc.jobs.deploy;
  if (!deployJob) throw new Error('deploy.yml no longer defines a deploy job');
  return deployJob.steps;
}

const FALLBACK_GUARD = '[ "${CHECKOUT_OUTCOME:-}" != "success" ]';
const HELPER_INVOCATION =
  'bash scripts/deploy/deploy-summary.sh >> "$GITHUB_STEP_SUMMARY"';

describe('deploy.yml summary ↔ checkout integration', () => {
  const steps = loadDeployJobSteps();
  const checkoutStep = steps.find((step) =>
    step.uses?.startsWith('actions/checkout@'),
  );
  const summaryIndex = steps.findIndex(
    (step) => step.name === 'Deploy summary (observability)',
  );
  const summaryStep = summaryIndex >= 0 ? steps[summaryIndex] : undefined;
  const runText = summaryStep?.run ?? '';

  it('gives the checkout step the stable id the summary depends on', () => {
    expect(checkoutStep?.id).toBe('checkout');
  });

  it('runs the summary with if: always() and feeds it the real checkout outcome', () => {
    expect(summaryStep).toBeDefined();
    expect(summaryStep?.['if']).toBe('always()');
    expect(summaryStep?.env?.CHECKOUT_OUTCOME).toBe(
      '${{ steps.checkout.outcome }}',
    );
  });

  it('branches on checkout outcome BEFORE requiring any repository file', () => {
    const guardAt = runText.indexOf(FALLBACK_GUARD);
    const firstScriptRef = runText.indexOf('scripts/');
    expect(guardAt).toBeGreaterThanOrEqual(0);
    expect(firstScriptRef).toBeGreaterThan(guardAt);
  });

  it('keeps the fallback branch free of repository-file dependencies', () => {
    const elseAt = runText.indexOf('else');
    expect(elseAt).toBeGreaterThan(0);
    const fallbackBranch = runText.slice(
      runText.indexOf(FALLBACK_GUARD),
      elseAt,
    );
    expect(fallbackBranch).not.toContain('scripts/');
    expect(fallbackBranch).toContain('GITHUB_STEP_SUMMARY');
    // Only facts provable without the repository tree may appear.
    expect(fallbackBranch).toContain(
      '**FAILED** before deployment preparation / exact-SHA decision completed',
    );
    expect(fallbackBranch).toContain('no server mutation');
    expect(fallbackBranch).not.toContain('superseded');
    expect(fallbackBranch.toLowerCase()).not.toContain('rollback');
  });

  it('invokes the tested classifier only on the checkout-succeeded branch', () => {
    const elseAt = runText.indexOf('else');
    const fiAt = runText.lastIndexOf('fi');
    const successBranch = runText.slice(elseAt, fiAt);
    expect(successBranch).toContain(HELPER_INVOCATION);
    // Exactly one helper invocation in the whole step, inside that branch only.
    expect(runText.split('scripts/deploy/deploy-summary.sh').length - 1).toBe(
      1,
    );
  });

  it('executing the extracted fallback from an EMPTY directory still renders a summary', () => {
    // Anchor on the block form `{ … } >> "$GITHUB_STEP_SUMMARY"`, not on any `{`
    // (the guard line itself contains `${CHECKOUT_OUTCOME:-}`).
    const blockMatch = runText.match(
      /(\s*\{\n[\s\S]*?\n\s*\} >> "\$GITHUB_STEP_SUMMARY")/,
    );
    expect(blockMatch).not.toBeNull();
    const fallbackBlock = blockMatch?.[1];
    if (!fallbackBlock) throw new Error('fallback block capture failed');

    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-fallback-'));
    const summaryFile = path.join(scratch, 'step-summary.md');
    try {
      // cwd = empty temp dir: no repository files exist, mirroring a failed checkout.
      const result = spawnSync('bash', ['-c', fallbackBlock], {
        encoding: 'utf8',
        cwd: scratch,
        env: {
          ...process.env,
          GITHUB_STEP_SUMMARY: summaryFile,
          TRIGGER: 'push',
          SHA: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555',
          RELEASE_ID: '',
          CHECKOUT_OUTCOME: 'failure',
        },
      });

      expect(result.status).toBe(0);
      const rendered = fs.readFileSync(summaryFile, 'utf8');
      expect(rendered).toContain('- trigger: `push`');
      expect(rendered).toContain(
        '- target SHA: `aaaa1111bbbb2222cccc3333dddd4444eeee5555`',
      );
      expect(rendered).toContain('- release id: `<none>`');
      expect(rendered).toContain(
        '- result: **FAILED** before deployment preparation / exact-SHA decision completed (checkout outcome: `failure`)',
      );
      expect(rendered).toContain('no server mutation');
      expect(rendered).not.toContain('superseded');
      expect(rendered.toLowerCase()).not.toContain('rollback');
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });
});
