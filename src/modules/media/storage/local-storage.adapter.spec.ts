import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageAdapter } from './local-storage.adapter';

describe('LocalStorageAdapter', () => {
  const origin = 'http://localhost:3001/media';
  let rootDir: string;
  let adapter: LocalStorageAdapter;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'media-local-'));
    adapter = new LocalStorageAdapter({ rootDir, publicMediaUrl: origin });
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const put = (key: string, body: Buffer): Promise<void> =>
    adapter.put({
      key,
      body,
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    });

  it('writes exact bytes to a nested key', async () => {
    const body = Buffer.from([0, 1, 2, 250, 255]);
    await put('a/b/c.webp', body);
    const written = await readFile(join(rootDir, 'a/b/c.webp'));
    expect(written.equals(body)).toBe(true);
  });

  it('atomically replaces an existing object', async () => {
    await put('x.webp', Buffer.from('first'));
    await put('x.webp', Buffer.from('second'));
    const written = await readFile(join(rootDir, 'x.webp'));
    expect(written.toString()).toBe('second');
  });

  it('rejects an absolute key', async () => {
    await expect(put('/etc/passwd', Buffer.from('x'))).rejects.toThrow(
      /absolute/i,
    );
  });

  it('rejects path traversal on put and delete', async () => {
    await expect(put('../escape.webp', Buffer.from('x'))).rejects.toThrow(
      /escapes/i,
    );
    await expect(adapter.delete('../../escape')).rejects.toThrow(/escapes/i);
  });

  it('deletes idempotently (a missing object is not an error)', async () => {
    await expect(
      adapter.delete('does/not/exist.webp'),
    ).resolves.toBeUndefined();
  });

  it('deleteMany surfaces per-key failures', async () => {
    await put('keep.webp', Buffer.from('k'));
    const result = await adapter.deleteMany(['keep.webp', '../bad']);
    expect(result.deleted).toEqual(['keep.webp']);
    expect(result.failed.map((failure) => failure.key)).toEqual(['../bad']);
  });

  it('builds a public URL from the configured origin', () => {
    expect(adapter.publicUrl('a/b.webp')).toBe(`${origin}/a/b.webp`);
  });

  it('cleans up the temp file when the write fails', async () => {
    // Make the target path an existing, non-empty directory so rename() fails.
    const key = 'blocked/obj.webp';
    await mkdir(join(rootDir, key), { recursive: true });
    await writeFile(join(rootDir, key, 'sentinel'), 'x');

    await expect(put(key, Buffer.from('data'))).rejects.toThrow();

    const parent = await readdir(join(rootDir, 'blocked'));
    expect(parent.some((entry) => entry.startsWith('.tmp-'))).toBe(false);
  });
});
