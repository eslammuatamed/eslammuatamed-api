import { spawn, spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { gzipSync } from 'node:zlib';

const SCRIPT = path.join(__dirname, 'offsite-backup.sh');
const RCLONE_VERSION = '1.75.0';
let base: string;
let sourceDir: string;
let remoteDir: string;
let configFile: string;
let envFile: string;
let lockFile: string;
let logFile: string;
let fakeRclone: string;

function writeExecutable(file: string, body: string): void {
  fs.writeFileSync(file, body, { mode: 0o755 });
}

function makeFakeRclone(): void {
  fakeRclone = path.join(base, 'fake-rclone');
  writeExecutable(
    fakeRclone,
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == version ]]; then echo "rclone v${RCLONE_VERSION}"; exit 0; fi
while [[ "\${1:-}" == --config ]]; do shift 2; done
cmd="$1"; shift
echo "$cmd $*" >> "$FAKE_RCLONE_LOG"
root='test-r2:private-db-backups'
to_local() { local target="$1"; printf '%s/%s' "$FAKE_RCLONE_REMOTE" "\${target#"$root"/}"; }
case "$cmd" in
  lsf)
    [[ "\${FAKE_RCLONE_SLEEP_LSF:-0}" == 1 ]] && sleep 1
    recursive=0
    if [[ "$1" == -R || "$1" == --recursive ]]; then recursive=1; shift; fi
    [[ "$1" == "$root" ]]; shift
    include=''
    while (($#)); do
      if [[ "$1" == --include ]]; then include="$2"; shift 2; else shift; fi
    done
    if ((recursive)) || [[ "$include" != */* ]]; then
      [[ -f "$FAKE_RCLONE_REMOTE/$include" ]] && printf '%s\n' "$include"
    fi
    ;;
  copyto)
    ignore=0
    [[ "\${1:-}" == --ignore-existing ]] && { ignore=1; shift; }
    from="$1"; to="$2"; local_to="$(to_local "$to")"
    mkdir -p "$(dirname "$local_to")"
    if [[ "\${FAKE_RCLONE_INJECT_CONFLICTING_MANIFEST:-0}" == 1 && "$to" == *.sql.gz ]]; then
      printf 'version=1\nsource_filename=concurrent.sql.gz\nsize_bytes=1\nsha256=0\ncompleted_at_utc=20260826T060000Z\n' > "\${local_to}.manifest"
    fi
    if ((ignore)) && [[ -e "$local_to" ]]; then exit 0; fi
    cp -- "$from" "$local_to"
    ;;
  cat)
    local_to="$(to_local "$1")"
    if [[ "\${FAKE_RCLONE_CORRUPT:-0}" == 1 && "$1" == *.sql.gz ]]; then printf 'corrupt'; else cat -- "$local_to"; fi
    ;;
  *) echo "unexpected rclone command: $cmd" >&2; exit 88 ;;
esac
`,
  );
}

function writeRuntimeContract(): void {
  fs.writeFileSync(configFile, '[backup-r2]\ntype = s3\n');
  fs.writeFileSync(
    envFile,
    `OFFSITE_RCLONE_CONFIG=${configFile}\nOFFSITE_RCLONE_ROOT=test-r2:private-db-backups\n`,
  );
  fs.chmodSync(configFile, 0o600);
  fs.chmodSync(envFile, 0o600);
}

function makeBackup(
  timestamp: string,
  ageSeconds: number,
  contents = `backup-${timestamp}`,
): string {
  const file = path.join(sourceDir, `eslammuatamed_prod-${timestamp}.sql.gz`);
  fs.writeFileSync(file, gzipSync(contents));
  const time = new Date(Date.now() - ageSeconds * 1_000);
  fs.utimesSync(file, time, time);
  return file;
}

function remoteKeyFor(file: string): string {
  const mtime = Math.floor(fs.statSync(file).mtimeMs / 1_000);
  const timestamp = new Date(mtime * 1_000)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const sha = crypto
    .createHash('sha256')
    .update(fs.readFileSync(file))
    .digest('hex');
  return `postgres/eslammuatamed_prod-${timestamp}-${sha.slice(0, 12)}.sql.gz`;
}

function executionEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    OFFSITE_BACKUP_ENV_FILE: envFile,
    OFFSITE_BACKUP_SOURCE_DIR: sourceDir,
    OFFSITE_BACKUP_LOCK_FILE: lockFile,
    OFFSITE_BACKUP_RCLONE_BIN: fakeRclone,
    OFFSITE_BACKUP_RCLONE_VERSION: RCLONE_VERSION,
    FAKE_RCLONE_REMOTE: remoteDir,
    FAKE_RCLONE_LOG: logFile,
    ...extra,
  };
}

function run(extra: Record<string, string> = {}) {
  return spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: executionEnv(extra),
  });
}

function operations(): string[] {
  return fs.existsSync(logFile)
    ? fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean)
    : [];
}

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-backup-spec-'));
  sourceDir = path.join(base, 'source');
  remoteDir = path.join(base, 'remote');
  configFile = path.join(base, 'rclone.conf');
  envFile = path.join(base, 'offsite.env');
  lockFile = path.join(base, 'lock', 'offsite.lock');
  logFile = path.join(base, 'rclone.log');
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(remoteDir, { recursive: true });
  makeFakeRclone();
  writeRuntimeContract();
});

afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

describe('candidate selection and local integrity', () => {
  it('selects exactly the newest eligible completed backup', () => {
    makeBackup('20260825T031500Z', 20_000);
    const newest = makeBackup('20260826T031500Z', 7_200);

    const result = run();

    expect(result.status).toBe(0);
    const manifest = fs.readFileSync(
      path.join(remoteDir, `${remoteKeyFor(newest)}.manifest`),
      'utf8',
    );
    expect(manifest).toContain(`source_filename=${path.basename(newest)}`);
  });

  it('rejects a too-young file instead of observing a writer in progress', () => {
    makeBackup('20260826T060000Z', 60);
    expect(run().stderr).toContain(
      'no eligible recent completed backup exists',
    );
    expect(operations()).not.toContainEqual(expect.stringContaining('copyto'));
  });

  it('rejects a stale backup rather than making the weekly run green', () => {
    makeBackup('20260825T031500Z', 86_401);
    expect(run().stderr).toContain(
      'no eligible recent completed backup exists',
    );
  });

  it('fails closed when no candidate exists', () => {
    expect(run().stderr).toContain(
      'no eligible recent completed backup exists',
    );
  });

  it('rejects invalid gzip before any R2 operation', () => {
    const file = path.join(
      sourceDir,
      'eslammuatamed_prod-20260826T031500Z.sql.gz',
    );
    fs.writeFileSync(file, 'not gzip');
    const time = new Date(Date.now() - 7_200_000);
    fs.utimesSync(file, time, time);

    const result = run();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('gzip integrity check failed');
    expect(operations()).not.toContainEqual(expect.stringContaining('copyto'));
  });
});

describe('remote integrity and idempotency', () => {
  it('uploads data and creates the manifest only after a matching remote SHA-256', () => {
    const backup = makeBackup('20260826T031500Z', 7_200);
    const key = remoteKeyFor(backup);

    const result = run();

    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(remoteDir, key))).toBe(true);
    expect(fs.existsSync(path.join(remoteDir, `${key}.manifest`))).toBe(true);
    const log = operations();
    expect(log.findIndex((line) => line.startsWith('cat '))).toBeLessThan(
      log.findIndex(
        (line) => line.startsWith('copyto ') && line.includes('.manifest'),
      ),
    );
  });

  it('fails if the remote SHA-256 differs and never creates a manifest', () => {
    const backup = makeBackup('20260826T031500Z', 7_200);
    const key = remoteKeyFor(backup);

    const result = run({ FAKE_RCLONE_CORRUPT: '1' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'remote backup SHA-256 does not match local backup',
    );
    expect(fs.existsSync(path.join(remoteDir, `${key}.manifest`))).toBe(false);
  });

  it('accepts an existing matching data object plus completion manifest idempotently', () => {
    makeBackup('20260826T031500Z', 7_200);
    expect(run().status).toBe(0);
    const firstCopies = operations().filter((line) =>
      line.startsWith('copyto '),
    ).length;

    expect(run().status).toBe(0);
    expect(
      operations().filter((line) => line.startsWith('copyto ')),
    ).toHaveLength(firstCopies);
  });

  it('finishes a matching unmanifested object without overwriting its data', () => {
    const backup = makeBackup('20260826T031500Z', 7_200);
    const key = remoteKeyFor(backup);
    const target = path.join(remoteDir, key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(backup, target);

    expect(run().status).toBe(0);
    expect(fs.existsSync(path.join(remoteDir, `${key}.manifest`))).toBe(true);
    expect(
      operations().filter(
        (line) => line.startsWith('copyto ') && line.includes('.sql.gz '),
      ),
    ).toHaveLength(0);
  });

  it('fails closed on a conflicting manifest', () => {
    const backup = makeBackup('20260826T031500Z', 7_200);
    const key = remoteKeyFor(backup);
    const target = path.join(remoteDir, key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(backup, target);
    const conflictingManifest =
      'version=1\nsource_filename=wrong.sql.gz\nsize_bytes=1\nsha256=0\ncompleted_at_utc=20260826T060000Z\n';
    fs.writeFileSync(
      path.join(remoteDir, `${key}.manifest`),
      conflictingManifest,
    );

    const result = run();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('existing completion manifest conflicts');
    expect(
      fs.readFileSync(path.join(remoteDir, `${key}.manifest`), 'utf8'),
    ).toBe(conflictingManifest);
    expect(operations()).not.toContainEqual(expect.stringContaining('copyto'));
  });

  it('fails closed when a manifest exists without its data object', () => {
    const backup = makeBackup('20260826T031500Z', 7_200);
    const key = remoteKeyFor(backup);
    const manifest = path.join(remoteDir, `${key}.manifest`);
    fs.mkdirSync(path.dirname(manifest), { recursive: true });
    fs.writeFileSync(manifest, 'incomplete marker');

    const result = run();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'completion manifest exists without its data object',
    );
    expect(fs.readFileSync(manifest, 'utf8')).toBe('incomplete marker');
    expect(operations()).not.toContainEqual(expect.stringContaining('copyto'));
  });

  it('fails closed without overwriting a manifest that appears during a retry', () => {
    const backup = makeBackup('20260826T031500Z', 7_200);
    const key = remoteKeyFor(backup);
    const manifest = path.join(remoteDir, `${key}.manifest`);

    const result = run({ FAKE_RCLONE_INJECT_CONFLICTING_MANIFEST: '1' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('completion manifest verification failed');
    expect(fs.readFileSync(manifest, 'utf8')).toContain(
      'source_filename=concurrent.sql.gz',
    );
  });
});

describe('runtime boundaries', () => {
  it('uses flock to prevent an overlapping invocation', async () => {
    makeBackup('20260826T031500Z', 7_200);
    const first = spawn('bash', [SCRIPT], {
      env: executionEnv({ FAKE_RCLONE_SLEEP_LSF: '1' }),
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const second = run();
    expect(second.status).not.toBe(0);
    expect(second.stderr).toContain(
      'another offsite backup invocation holds the lock',
    );
    await new Promise<void>((resolve) => first.on('exit', () => resolve()));
  });

  it('fails when the server-only runtime contract is absent', () => {
    fs.rmSync(envFile);
    expect(run().stderr).toContain('required readable file is missing');
  });

  it('fails when the pinned rclone executable is absent', () => {
    fs.rmSync(fakeRclone);
    expect(run().stderr).toContain('rclone executable is missing');
  });

  it('contains no remote-deletion path', () => {
    const source = fs.readFileSync(SCRIPT, 'utf8');
    expect(source).not.toMatch(
      /(?:rclone|RCLONE_BIN)[^\n]*(?:\bsync\b|\bdelete\b|\bpurge\b|\brmdir\b)/i,
    );
  });

  it('contains no database-mutating or backup-creation command', () => {
    const source = fs
      .readFileSync(SCRIPT, 'utf8')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');
    expect(source).not.toMatch(
      /\b(?:pg_dump|psql|prisma|systemctl|service)\b/i,
    );
  });
});
