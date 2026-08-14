import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// Regression cover for the 2026-08-14 production incident.
//
// Release `d2f516c` booted with no usable database connection, passed a liveness-only
// cutover gate, and was cut over anyway; because the automatic rollback hung off that same
// gate, the rollback never armed. These tests drive the REAL `remote-cutover.sh` against a
// temporary release tree and stubbed `curl`/`sudo`/`npx`/`tar`, so the gate's behaviour is
// asserted rather than assumed.
//
// The `curl` stub decides its answer from whichever release `current` points at — the same
// thing that determines the answer in production — which is what lets a test express "the
// new release is broken but the rollback target is fine".

const SCRIPT = path.join(__dirname, 'remote-cutover.sh');
const NEW_RELEASE = '20260814T190038Z-d2f516c';
const PREV_RELEASE = '20260807T131106Z-e3a3314';

const RUNNING_AS_ROOT =
  typeof process.getuid === 'function' && process.getuid() === 0;

let base: string;
let binDir: string;

function writeExecutable(file: string, body: string): void {
  fs.writeFileSync(file, body, { mode: 0o755 });
}

function makeStubs(): void {
  fs.mkdirSync(binDir, { recursive: true });

  // Answers per release: $DEPLOY_BASE/.stub/<release>.fail lists URL substrings that fail.
  writeExecutable(
    path.join(binDir, 'curl'),
    `#!/usr/bin/env bash
url="\${@: -1}"
cur="$(readlink -f "\${DEPLOY_BASE}/current" 2>/dev/null || echo none)"
rel="$(basename "$cur")"
f="\${DEPLOY_BASE}/.stub/\${rel}.fail"
if [ -f "$f" ]; then
  while IFS= read -r pat; do
    [ -n "$pat" ] || continue
    case "$url" in *"$pat"*) exit 22;; esac
  done < "$f"
fi
exit 0
`,
  );

  for (const cmd of ['sudo', 'npx', 'tar']) {
    writeExecutable(path.join(binDir, cmd), '#!/usr/bin/env bash\nexit 0\n');
  }
}

/** Mark specific endpoints as failing for a given release. */
function failFor(release: string, patterns: string[]): void {
  fs.mkdirSync(path.join(base, '.stub'), { recursive: true });
  // The trailing newline matters: `while read` in the stub drops a final unterminated line.
  fs.writeFileSync(
    path.join(base, '.stub', `${release}.fail`),
    `${patterns.join('\n')}\n`,
  );
}

function makeRelease(name: string, mtimeSeconds: number): string {
  const dir = path.join(base, 'releases', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'marker'), name);
  fs.utimesSync(dir, mtimeSeconds, mtimeSeconds);
  return dir;
}

function pointCurrentAt(release: string): void {
  const link = path.join(base, 'current');
  if (fs.existsSync(link)) fs.unlinkSync(link);
  fs.symlinkSync(path.join(base, 'releases', release), link);
}

function run(release = NEW_RELEASE, extraEnv: Record<string, string> = {}) {
  return spawnSync('bash', [SCRIPT, release], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
      DEPLOY_BASE: base,
      API_BASE_URL: 'http://127.0.0.1:3001/api/v1',
      TARBALL_PATH: path.join(base, 'fake.tar.gz'),
      KEEP_RELEASES: '5',
      ...extraEnv,
    },
  });
}

function currentTarget(): string {
  return path.basename(fs.realpathSync(path.join(base, 'current')));
}

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'cutover-spec-'));
  binDir = path.join(base, 'bin');
  makeStubs();

  fs.mkdirSync(path.join(base, 'shared'), { recursive: true });
  // Sourced by the script. Deliberately contains no real credential — the spec never
  // touches a real environment file (see the standing rule about the local .env).
  fs.writeFileSync(path.join(base, 'shared', '.env'), 'STUB_ENV=1\n');
  fs.writeFileSync(path.join(base, 'fake.tar.gz'), 'not-a-real-tarball');

  makeRelease(PREV_RELEASE, 1_700_000_000);
  pointCurrentAt(PREV_RELEASE);
});

afterEach(() => {
  // Restore any deliberately unwritable directory so cleanup can succeed.
  const releases = path.join(base, 'releases');
  if (fs.existsSync(releases)) {
    for (const entry of fs.readdirSync(releases)) {
      try {
        fs.chmodSync(path.join(releases, entry), 0o755);
      } catch {
        /* already writable */
      }
    }
  }
  fs.rmSync(base, { recursive: true, force: true });
});

describe('post-cutover verification', () => {
  it('treats a release that is live but not DB-ready as FAILED and rolls back', () => {
    // The exact incident: /health answers 200 while the database is unreachable.
    failFor(NEW_RELEASE, ['/health/ready', '/settings/site', '/projects']);

    const result = run();

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('[ok]   liveness');
    expect(result.stderr).toContain('[FAIL] readiness');
    expect(result.stderr).toContain('rolling the application back');
    // Liveness passing must NOT be enough to keep the release live.
    expect(currentTarget()).toBe(PREV_RELEASE);
  });

  it('fails when readiness alone fails, even with every other probe green', () => {
    failFor(NEW_RELEASE, ['/health/ready']);

    const result = run();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('[FAIL] readiness');
    expect(currentTarget()).toBe(PREV_RELEASE);
  });

  it('fails when a DB-backed smoke endpoint fails, even with readiness green', () => {
    failFor(NEW_RELEASE, ['/settings/site']);

    const result = run();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('[FAIL] smoke     /settings/site');
    expect(currentTarget()).toBe(PREV_RELEASE);
  });

  it('fails when /projects fails', () => {
    failFor(NEW_RELEASE, ['/projects']);

    const result = run();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('[FAIL] smoke     /projects');
    expect(currentTarget()).toBe(PREV_RELEASE);
  });

  it('succeeds and keeps the new release live when every probe passes', () => {
    const result = run();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[ok]   readiness');
    expect(result.stdout).toContain('[ok]   smoke     /settings/site');
    expect(result.stdout).toContain('[ok]   smoke     /projects');
    expect(result.stdout).toContain(
      `Post-cutover verification passed for release ${NEW_RELEASE}`,
    );
    expect(currentTarget()).toBe(NEW_RELEASE);
  });
});

describe('rollback verification', () => {
  it('re-verifies the rollback target with the full check, not just liveness', () => {
    failFor(NEW_RELEASE, ['/health/ready']);

    const result = run();

    // The rollback target is probed on all four endpoints too.
    expect(result.stdout).toContain(`Verifying rollback target`);
    expect(result.stdout).toContain('[ok]   readiness');
    expect(result.stderr).toContain('full verification passed');
    expect(result.status).not.toBe(0);
  });

  it('reports MANUAL INTERVENTION when the rollback target is also unhealthy', () => {
    failFor(NEW_RELEASE, ['/health/ready']);
    failFor(PREV_RELEASE, ['/health/ready']);

    const result = run();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'verification STILL FAILING — MANUAL INTERVENTION REQUIRED',
    );
  });
});

describe('release pruning', () => {
  it('removes superseded releases beyond the keep window', () => {
    for (let i = 0; i < 5; i++) {
      makeRelease(`old-${i}`, 1_600_000_000 + i);
    }

    const result = run(NEW_RELEASE, { KEEP_RELEASES: '2' });

    expect(result.status).toBe(0);
    const remaining = fs.readdirSync(path.join(base, 'releases'));
    expect(remaining).toContain(NEW_RELEASE);
    expect(remaining.length).toBeLessThan(7);
    expect(result.stdout).not.toContain('PRUNE_INCOMPLETE');
  });

  it('never prunes the release that is currently live', () => {
    // Give the live release the OLDEST mtime so a naive keep-newest-N would delete it.
    const result = run(NEW_RELEASE, { KEEP_RELEASES: '0' });

    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(base, 'releases', NEW_RELEASE))).toBe(true);
    expect(currentTarget()).toBe(NEW_RELEASE);
  });

  const ownershipIt = RUNNING_AS_ROOT ? it.skip : it;
  ownershipIt(
    'reports an unremovable legacy release without failing the deployment',
    () => {
      // Models the real condition: the oldest release was created by an early manual
      // deploy, its files belong to another user, and `deploy` cannot unlink them. Root
      // bypasses permission checks, so this case is only meaningful as a non-root user —
      // it is skipped, loudly, rather than silently passing when run as root.
      const stuck = makeRelease('legacy-manual-release', 1_500_000_000);
      fs.writeFileSync(path.join(stuck, 'undeletable'), 'x');
      fs.chmodSync(stuck, 0o555);

      const result = run(NEW_RELEASE, { KEEP_RELEASES: '1' });

      // The deployment itself is healthy, so it must not be reported as failed…
      expect(result.status).toBe(0);
      // …but the failure must be named, not swallowed.
      expect(result.stdout).toContain('PRUNE_INCOMPLETE:');
      expect(result.stdout).toContain('legacy-manual-release');
      expect(fs.existsSync(stuck)).toBe(true);
    },
  );
});

describe('script hygiene', () => {
  it('parses under bash -n and passes shellcheck when available', () => {
    execFileSync('bash', ['-n', SCRIPT]);

    const hasShellcheck =
      spawnSync('sh', ['-c', 'command -v shellcheck']).status === 0;
    if (!hasShellcheck) {
      // Recorded rather than silently skipped: absence of the linter is not a pass.
      console.warn(
        'shellcheck not installed — static lint of remote-cutover.sh not run',
      );
      return;
    }
    const lint = spawnSync('shellcheck', ['-S', 'warning', SCRIPT], {
      encoding: 'utf8',
    });
    expect(lint.stdout + lint.stderr).toBe('');
    expect(lint.status).toBe(0);
  });
});
