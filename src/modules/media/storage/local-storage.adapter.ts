import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import {
  DeleteManyResult,
  PutObjectInput,
  StorageAdapter,
  StorageDeletionFailure,
} from './storage-adapter.interface';

export interface LocalStorageOptions {
  readonly rootDir: string;
  readonly publicMediaUrl: string;
}

// Filesystem backend for development and tests (D07-4). Writes are atomic — a temp file in the
// target's own directory followed by a rename — so a crashed write never leaves a half-written
// object, and every key is contained beneath rootDir so a crafted key cannot escape it.
export class LocalStorageAdapter implements StorageAdapter {
  private readonly rootDir: string;
  private readonly publicMediaUrl: string;

  constructor(options: LocalStorageOptions) {
    this.rootDir = resolve(options.rootDir);
    this.publicMediaUrl = options.publicMediaUrl;
  }

  async put(input: PutObjectInput): Promise<void> {
    const target = this.resolveKey(input.key);
    await mkdir(dirname(target), { recursive: true });
    // Temp file in the SAME directory as the target so rename() is atomic on one filesystem.
    const tempPath = join(dirname(target), `.tmp-${randomUUID()}`);
    try {
      await writeFile(tempPath, input.body);
      await rename(tempPath, target);
    } catch (error) {
      // Don't leave the partial temp file behind; ignore a failed cleanup of an already-gone file.
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const target = this.resolveKey(key);
    // force: true makes deleting a missing object a no-op (idempotent).
    await rm(target, { force: true });
  }

  async deleteMany(keys: readonly string[]): Promise<DeleteManyResult> {
    const outcomes = await Promise.all(
      keys.map(async (key) => {
        try {
          await this.delete(key);
          return { key, ok: true as const };
        } catch (error) {
          return {
            key,
            ok: false as const,
            reason: error instanceof Error ? error.message : 'unknown error',
          };
        }
      }),
    );

    const deleted: string[] = [];
    const failed: StorageDeletionFailure[] = [];
    for (const outcome of outcomes) {
      if (outcome.ok) {
        deleted.push(outcome.key);
      } else {
        failed.push({ key: outcome.key, reason: outcome.reason });
      }
    }
    return { deleted, failed };
  }

  publicUrl(key: string): string {
    return `${this.publicMediaUrl}/${key}`;
  }

  // Resolves a relative key beneath rootDir; rejects absolute keys and any traversal that would
  // escape the root (defence in depth — keys are server-generated, so this should never fire).
  private resolveKey(key: string): string {
    if (isAbsolute(key)) {
      throw new Error(
        'Storage key must be relative, received an absolute path',
      );
    }
    const target = resolve(this.rootDir, key);
    const rootWithSep = this.rootDir.endsWith(sep)
      ? this.rootDir
      : `${this.rootDir}${sep}`;
    if (target !== this.rootDir && !target.startsWith(rootWithSep)) {
      throw new Error('Storage key escapes the storage root');
    }
    return target;
  }
}
