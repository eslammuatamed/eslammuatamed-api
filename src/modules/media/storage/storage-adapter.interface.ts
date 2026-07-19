// The storage seam (D07-4): every backend implements this contract, and no business code
// touches a storage SDK directly. A NestJS interface has no runtime representation, so DI binds
// to the Symbol token below — consumers inject via `@Inject(STORAGE_ADAPTER)`.
export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');

// One stored object. `cacheControl` is always set (image objects are immutable, D20-6);
// `contentDisposition` is the resume-PDF download header (doc 19 §5) and absent otherwise.
export interface PutObjectInput {
  readonly key: string;
  readonly body: Buffer;
  readonly contentType: string;
  readonly cacheControl: string;
  readonly contentDisposition?: string;
}

export interface StorageDeletionFailure {
  readonly key: string;
  readonly reason: string;
}

// deleteMany reports per-object outcomes instead of collapsing a partial failure into success —
// the D07-6 compensation flow must know exactly which objects still exist.
export interface DeleteManyResult {
  readonly deleted: readonly string[];
  readonly failed: readonly StorageDeletionFailure[];
}

export interface StorageAdapter {
  put(input: PutObjectInput): Promise<void>;
  delete(key: string): Promise<void>;
  deleteMany(keys: readonly string[]): Promise<DeleteManyResult>;
  publicUrl(key: string): string;
}
