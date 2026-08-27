import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface WorkflowStep {
  name?: string;
  uses?: string;
  ['if']?: string;
  env?: Record<string, string>;
  run?: string;
}

interface Workflow {
  on?: { schedule?: Array<{ cron?: string }>; workflow_dispatch?: unknown };
  permissions?: Record<string, unknown>;
  concurrency?: { group?: string; ['cancel-in-progress']?: boolean };
  jobs?: Record<
    string,
    { ['timeout-minutes']?: number; steps?: WorkflowStep[] }
  >;
}

const WORKFLOW_PATH = path.join(
  __dirname,
  '..',
  '..',
  '.github',
  'workflows',
  'backup-offsite.yml',
);
const requireFromRepo = createRequire(__filename);
const yaml = requireFromRepo('js-yaml') as { load(text: string): Workflow };

function workflow(): Workflow {
  return yaml.load(fs.readFileSync(WORKFLOW_PATH, 'utf8'));
}

describe('backup-offsite workflow contract', () => {
  const doc = workflow();
  const job = doc.jobs?.['trigger-vps-backup'];
  const steps = job?.steps ?? [];
  const source = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  const runText = steps.map((step) => step.run ?? '').join('\n');

  it('runs only weekly at the approved UTC minute and by deliberate dispatch', () => {
    expect(doc.on?.schedule).toEqual([{ cron: '17 6 * * 0' }]);
    expect(doc.on).toHaveProperty('workflow_dispatch');
    expect(source).not.toMatch(
      /^\s*(?:push|pull_request|pull_request_target|workflow_run):/m,
    );
  });

  it('has no token capability, source checkout, or deployment action', () => {
    expect(doc.permissions).toEqual({});
    expect(
      steps.some((step) => step.uses?.startsWith('actions/checkout@')),
    ).toBe(false);
    expect(source).not.toMatch(
      /deploy(?:-fallback)?\.ya?ml|workflow_dispatch.*deploy/i,
    );
  });

  it('serializes runs without cancelling an already-running backup and bounds the runner', () => {
    expect(doc.concurrency?.group).toBe('private-offsite-database-backup');
    expect(doc.concurrency?.['cancel-in-progress']).toBe(false);
    expect(job?.['timeout-minutes']).toBe(10);
  });

  it('uses only the dedicated backup SSH material and cleaned restrictive runner files', () => {
    expect(source).toContain('BACKUP_SSH_KEY');
    expect(source).toContain('BACKUP_KNOWN_HOSTS');
    expect(source).toContain('BACKUP_SSH_HOST');
    expect(source).toContain('BACKUP_SSH_USER');
    expect(source).toContain('BACKUP_SSH_PORT');
    expect(source).not.toMatch(/DEPLOY_(?:SSH_KEY|KNOWN_HOSTS|HOST|USER)/);
    expect(runText).toContain('umask 077');
    expect(runText).toContain('chmod 600');
    expect(steps.at(-1)?.['if']).toBe('always()');
    expect(steps.at(-1)?.run).toContain('rm -rf');
  });

  it('uses a pinned known host and a forced-command-compatible SSH transport', () => {
    expect(runText).toContain('ssh -T');
    expect(runText).toContain('BatchMode=yes');
    expect(runText).toContain('IdentitiesOnly=yes');
    expect(runText).toContain('StrictHostKeyChecking=yes');
    expect(runText).toContain('UserKnownHostsFile=');
    expect(runText).not.toContain('StrictHostKeyChecking=no');
    expect(runText).not.toContain('ssh-keyscan');
  });

  it('does not transit database bytes or R2 access through GitHub', () => {
    expect(source).not.toMatch(/rclone|R2_|AWS_ACCESS|S3_/i);
    expect(source).not.toMatch(
      /upload-artifact|download-artifact|pg_dump|postgres/i,
    );
    expect(runText).not.toContain('set -x');
  });
});
