import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

// Regression cover for the 2026-08-22 investigation of the production deploy summary
// (deploy.yml "Deploy summary" step).
//
// The old inline logic inferred events from absence of evidence: an empty
// `steps.gate.outputs.proceed` — which is what GitHub yields when the gate step never
// ran — was reported as "**superseded**", and every non-success cutover outcome was
// reported as "auto-rollback attempted and re-verified". Neither claim was provable
// from the recorded state.
//
// These tests drive the REAL classifier the workflow invokes
// (`scripts/deploy/deploy-summary.sh`) through the same environment contract, so a
// regression here is a regression in production reporting. Each case asserts both what
// must appear and what must NOT appear, because the defects being pinned were wrong
// positive claims, not missing ones.

const SCRIPT = path.join(__dirname, 'deploy-summary.sh');

interface SummaryState {
  trigger?: string;
  sha?: string;
  releaseId?: string;
  gateOutcome?: string;
  proceed?: string;
  shipOutcome?: string;
  cutoverOutcome?: string;
  pruneIncomplete?: string;
  pruneDirs?: string;
}

function run(state: SummaryState) {
  return spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      TRIGGER: state.trigger ?? '',
      SHA: state.sha ?? '',
      RELEASE_ID: state.releaseId ?? '',
      GATE_OUTCOME: state.gateOutcome ?? '',
      PROCEED: state.proceed ?? '',
      SHIP_OUTCOME: state.shipOutcome ?? '',
      CUTOVER_OUTCOME: state.cutoverOutcome ?? '',
      PRUNE_INCOMPLETE: state.pruneIncomplete ?? '',
      PRUNE_DIRS: state.pruneDirs ?? '',
    },
  });
}

/**
 * A build-lane failure before the gate. Steps after the failed one are skipped, and a
 * skipped step that declares an id reports outcome 'skipped' (GitHub contexts
 * reference) — which is exactly what the classifier requires before trusting any
 * "no server mutation" wording.
 */
const PRE_GATE_FAILURE: SummaryState = {
  trigger: 'push',
  sha: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555',
  releaseId: '20260822T120000Z-aaaa111',
  gateOutcome: 'skipped',
  shipOutcome: 'skipped',
  cutoverOutcome: 'skipped',
};

describe('summary labels', () => {
  it('labels the SHA as target and the release as an id, never as deployed', () => {
    const result = run({
      ...PRE_GATE_FAILURE,
      releaseId: '20260822T120000Z-aaaa111',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('target SHA');
    expect(result.stdout).toContain('release id');
    expect(result.stdout).not.toContain('deployed SHA');
  });

  it('renders <none> when no release id was computed yet', () => {
    const result = run({ trigger: 'push', sha: 'x' });

    expect(result.stdout).toContain('- release id: `<none>`');
  });
});

describe('pre-gate and gate failures (Concern A)', () => {
  it('does NOT report superseded when an earlier step failed and the gate never ran', () => {
    const result = run(PRE_GATE_FAILURE);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('- result: **FAILED**');
    expect(result.stdout).toContain(
      'before the exact-SHA supersession decision completed (gate outcome: `skipped`)',
    );
    expect(result.stdout).toContain('no server mutation');
    // The defect under test: absent PROCEED must never read as a proven main move.
    expect(result.stdout).not.toContain('superseded');
  });

  it('does NOT report superseded when the gate itself failed on the main-tip lookup', () => {
    const result = run({ ...PRE_GATE_FAILURE, gateOutcome: 'failure' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      'before the exact-SHA supersession decision completed (gate outcome: `failure`)',
    );
    expect(result.stdout).not.toContain('superseded');
  });

  it('reports genuine supersession only when the gate succeeded and said proceed=false', () => {
    const result = run({
      ...PRE_GATE_FAILURE,
      gateOutcome: 'success',
      proceed: 'false',
      shipOutcome: 'skipped',
      cutoverOutcome: 'skipped',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('- result: **superseded**');
    expect(result.stdout).toContain('no server mutation');
    expect(result.stdout).not.toContain('**FAILED**');
  });
});

describe('shipping and remote failures (Concern B)', () => {
  it('reports a shipping failure without any rollback claim', () => {
    const result = run({
      ...PRE_GATE_FAILURE,
      gateOutcome: 'success',
      proceed: 'true',
      shipOutcome: 'failure',
      cutoverOutcome: 'skipped',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      '- result: **FAILED** while shipping the release tarball, before remote cutover started',
    );
    // The scp step may have staged a tarball on the server, so nothing stronger than
    // "before remote cutover started" may be claimed — and rollback certainly cannot be.
    expect(result.stdout).not.toMatch(/rollback/i);
  });

  it('reports a remote cutover failure neutrally, without claiming rollback ran or was verified', () => {
    const result = run({
      ...PRE_GATE_FAILURE,
      gateOutcome: 'success',
      proceed: 'true',
      shipOutcome: 'success',
      cutoverOutcome: 'failure',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      '- result: **FAILED** during remote cutover / migration / verification',
    );
    expect(result.stdout).toContain('inspect the cutover logs');
    // The workflow only knows the remote step exited nonzero: extraction, migration,
    // symlink, restart, verification or rollback could each be the failing phase.
    // The two phrases below are exactly what the old summary asserted unconditionally.
    expect(result.stdout).not.toContain('auto-rollback attempted');
    expect(result.stdout).not.toContain('re-verified');
  });
});

describe('successful release', () => {
  it('reports released only for the full acceptance path and keeps cleanup reporting', () => {
    const result = run({
      ...PRE_GATE_FAILURE,
      gateOutcome: 'success',
      proceed: 'true',
      shipOutcome: 'success',
      cutoverOutcome: 'success',
      pruneIncomplete: 'false',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('- result: **released**');
    expect(result.stdout).toContain(
      'liveness + readiness + DB-backed smoke all passed',
    );
    expect(result.stdout).toContain('- cleanup: old releases pruned');
    expect(result.stdout).not.toContain('superseded');
    expect(result.stdout).not.toContain('**FAILED**');
  });

  it('surfaces pruning incompleteness without calling the deployment failed', () => {
    const result = run({
      ...PRE_GATE_FAILURE,
      gateOutcome: 'success',
      proceed: 'true',
      shipOutcome: 'success',
      cutoverOutcome: 'success',
      pruneIncomplete: 'true',
      pruneDirs: '/srv/eslammuatamed-api/releases/legacy',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('- result: **released**');
    expect(result.stdout).toContain('pruning incomplete');
    expect(result.stdout).toContain('/srv/eslammuatamed-api/releases/legacy');
  });
});

describe('unexpected states fail truthful, not optimistic', () => {
  it.each([
    ['every signal absent', {}],
    [
      'proceed=true but ship skipped while cutover failed',
      { gateOutcome: 'success', proceed: 'true', cutoverOutcome: 'failure' },
    ],
    [
      'ship failed yet cutover reports failure too',
      {
        gateOutcome: 'success',
        proceed: 'true',
        shipOutcome: 'failure',
        cutoverOutcome: 'failure',
      },
    ],
  ])(
    '%s is reported as unexpected, never released or superseded',
    (_name, state) => {
      const result = run(state);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('unexpected deployment state');
      expect(result.stdout).toContain('- result: **FAILED**');
      expect(result.stdout).not.toContain('**released**');
      expect(result.stdout).not.toContain('**superseded**');
    },
  );
});
