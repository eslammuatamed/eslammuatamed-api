import { ProcessingCapacityExceededException } from './processing-capacity.exception';
import { ProcessingConcurrencyLimiter } from './processing-concurrency.limiter';

// A promise whose resolution the test controls, so two "jobs" can be held in flight while a third
// upload is attempted.
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('ProcessingConcurrencyLimiter (Q3, doc 19 §6)', () => {
  it('runs work, returns its result, and releases the slot', async () => {
    const limiter = new ProcessingConcurrencyLimiter();
    await expect(limiter.run(() => Promise.resolve('ok'))).resolves.toBe('ok');
    expect(limiter.inFlight).toBe(0);
  });

  it('accepts two concurrent jobs and rejects the third with 429', async () => {
    const limiter = new ProcessingConcurrencyLimiter();
    const gate1 = deferred<string>();
    const gate2 = deferred<string>();

    const first = limiter.run(() => gate1.promise);
    const second = limiter.run(() => gate2.promise);
    expect(limiter.inFlight).toBe(2);

    await expect(
      limiter.run(() => Promise.resolve('third')),
    ).rejects.toBeInstanceOf(ProcessingCapacityExceededException);

    gate1.resolve('a');
    gate2.resolve('b');
    await Promise.all([first, second]);
    expect(limiter.inFlight).toBe(0);
  });

  it('accepts a new job once a slot frees', async () => {
    const limiter = new ProcessingConcurrencyLimiter();
    const gate1 = deferred<string>();
    const gate2 = deferred<string>();

    const first = limiter.run(() => gate1.promise);
    const second = limiter.run(() => gate2.promise);

    await expect(
      limiter.run(() => Promise.resolve('rejected')),
    ).rejects.toBeInstanceOf(ProcessingCapacityExceededException);

    gate1.resolve('done');
    await first;

    await expect(limiter.run(() => Promise.resolve('accepted'))).resolves.toBe(
      'accepted',
    );

    gate2.resolve('done');
    await second;
  });

  it('releases the slot even when work throws', async () => {
    const limiter = new ProcessingConcurrencyLimiter();
    await expect(
      limiter.run(() => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    expect(limiter.inFlight).toBe(0);
    await expect(limiter.run(() => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('exposes a positive Retry-After hint on the capacity exception', async () => {
    const limiter = new ProcessingConcurrencyLimiter();
    const gate1 = deferred<void>();
    const gate2 = deferred<void>();
    const first = limiter.run(() => gate1.promise);
    const second = limiter.run(() => gate2.promise);

    const error = await limiter
      .run(() => Promise.resolve())
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProcessingCapacityExceededException);
    expect(
      (error as ProcessingCapacityExceededException).retryAfterSeconds,
    ).toBeGreaterThan(0);

    gate1.resolve();
    gate2.resolve();
    await Promise.all([first, second]);
  });
});
