import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  DeleteManyResult,
  PutObjectInput,
  StorageAdapter,
  StorageDeletionFailure,
} from './storage-adapter.interface';

export interface R2StorageOptions {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly publicMediaUrl: string;
}

// Cloudflare R2 via the S3-compatible API (doc 23 §1, D23-15). AWS SDK types live only in this
// file — the rest of the app depends on StorageAdapter. No object ACLs (public delivery is a
// bucket/custom-domain concern) and no checksum workaround (added only if an integration test
// proves R2 requires it — owner directive). Nothing here logs credentials, request bodies, or keys.
export class R2StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicMediaUrl: string;

  constructor(options: R2StorageOptions) {
    this.bucket = options.bucket;
    this.publicMediaUrl = options.publicMediaUrl;
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async put(input: PutObjectInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl,
        ContentDisposition: input.contentDisposition,
        ContentLength: input.body.length,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    // R2 DeleteObject returns success even when the key is absent — naturally idempotent.
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async deleteMany(keys: readonly string[]): Promise<DeleteManyResult> {
    if (keys.length === 0) {
      return { deleted: [], failed: [] };
    }
    const response = await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: keys.map((key) => ({ Key: key })) },
      }),
    );

    const deleted = (response.Deleted ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => key !== undefined);
    // Surface per-object errors instead of treating a partial success as success (D07-6).
    const failed: StorageDeletionFailure[] = (response.Errors ?? []).map(
      (error) => ({
        key: error.Key ?? 'unknown',
        reason: error.Message ?? error.Code ?? 'unknown error',
      }),
    );
    return { deleted, failed };
  }

  publicUrl(key: string): string {
    return `${this.publicMediaUrl}/${key}`;
  }
}
