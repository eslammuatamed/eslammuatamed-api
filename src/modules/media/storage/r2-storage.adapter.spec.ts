// Mock the AWS SDK so no real R2 call is ever made. The commands are jest.fn() so their inputs are
// captured in mock.calls; `send` is shared across S3Client instances and controlled per test.
jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn();
  return {
    __send: send,
    S3Client: jest.fn().mockImplementation(() => ({ send })),
    PutObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    DeleteObjectsCommand: jest.fn(),
  };
});

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { R2StorageAdapter } from './r2-storage.adapter';

const mocked = jest.requireMock('@aws-sdk/client-s3');
const send = mocked.__send;

describe('R2StorageAdapter', () => {
  const options = {
    endpoint: 'https://acct.r2.cloudflarestorage.com',
    region: 'auto',
    bucket: 'media-bucket',
    accessKeyId: 'AKID',
    secretAccessKey: 'SECRET',
    publicMediaUrl: 'https://media.eslammuatamed.com',
  };
  let adapter: R2StorageAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new R2StorageAdapter(options);
  });

  it('configures the S3 client with region auto + the R2 endpoint + credentials', () => {
    expect(jest.mocked(S3Client)).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'auto',
        endpoint: options.endpoint,
        credentials: { accessKeyId: 'AKID', secretAccessKey: 'SECRET' },
      }),
    );
  });

  it('adds no speculative checksum override and no path-style override', () => {
    expect(jest.mocked(S3Client)).toHaveBeenCalledWith(
      expect.not.objectContaining({
        requestChecksumCalculation: expect.anything(),
      }),
    );
    expect(jest.mocked(S3Client)).toHaveBeenCalledWith(
      expect.not.objectContaining({ forcePathStyle: expect.anything() }),
    );
  });

  it('put sends PutObject with metadata + ContentLength and never an ACL', async () => {
    send.mockResolvedValue({});
    await adapter.put({
      key: 'k/1.webp',
      body: Buffer.from('abc'),
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
      contentDisposition: 'attachment; filename="cv.pdf"',
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(jest.mocked(PutObjectCommand)).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'media-bucket',
        Key: 'k/1.webp',
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
        ContentDisposition: 'attachment; filename="cv.pdf"',
        ContentLength: 3,
      }),
    );
    expect(jest.mocked(PutObjectCommand)).toHaveBeenCalledWith(
      expect.not.objectContaining({ ACL: expect.anything() }),
    );
  });

  it('delete sends DeleteObject for the key', async () => {
    send.mockResolvedValue({});
    await adapter.delete('k/1.webp');
    expect(jest.mocked(DeleteObjectCommand)).toHaveBeenCalledWith({
      Bucket: 'media-bucket',
      Key: 'k/1.webp',
    });
  });

  it('deleteMany surfaces per-object errors (a partial failure is not success)', async () => {
    send.mockResolvedValue({
      Deleted: [{ Key: 'a.webp' }],
      Errors: [{ Key: 'b.webp', Message: 'AccessDenied' }],
    });

    const result = await adapter.deleteMany(['a.webp', 'b.webp']);

    expect(jest.mocked(DeleteObjectsCommand)).toHaveBeenCalledWith({
      Bucket: 'media-bucket',
      Delete: { Objects: [{ Key: 'a.webp' }, { Key: 'b.webp' }] },
    });
    expect(result.deleted).toEqual(['a.webp']);
    expect(result.failed).toEqual([{ key: 'b.webp', reason: 'AccessDenied' }]);
  });

  it('deleteMany with no keys makes no request', async () => {
    const result = await adapter.deleteMany([]);
    expect(send).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: [], failed: [] });
  });

  it('builds a public URL on the media origin', () => {
    expect(adapter.publicUrl('k/1.webp')).toBe(
      'https://media.eslammuatamed.com/k/1.webp',
    );
  });

  it('never makes a real network call — send is always the mock', async () => {
    send.mockResolvedValue({});
    await adapter.put({
      key: 'x',
      body: Buffer.from('x'),
      contentType: 'image/webp',
      cacheControl: 'immutable',
    });
    expect(jest.isMockFunction(send)).toBe(true);
    expect(send).toHaveBeenCalled();
  });
});
