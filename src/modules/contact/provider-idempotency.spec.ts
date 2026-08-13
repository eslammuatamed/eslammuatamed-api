import { PROVIDER_IDEMPOTENCY_WINDOW_MS } from '../mail/mail.service';
import {
  deriveProviderIdempotencyKey,
  isWithinProviderIdempotencyWindow,
} from './provider-idempotency';

describe('deriveProviderIdempotencyKey', () => {
  // The literal shape, written out rather than rebuilt from the same pieces the function uses. A
  // test that assembled its expectation from a shared constant would pass against any prefix.
  it('namespaces the reply id under the provider’s recommended shape', () => {
    expect(
      deriveProviderIdempotencyKey('0192f3a0-0000-7000-8000-00000000abcd'),
    ).toBe('contact-reply/0192f3a0-0000-7000-8000-00000000abcd');
  });

  // The property the recovery path depends on. If this were ever derived from a clock, a body or a
  // request, a re-send would present a key the provider had never seen and mail the person twice.
  it('is stable across repeated derivations for one attempt', () => {
    const first = deriveProviderIdempotencyKey('reply-1');
    const second = deriveProviderIdempotencyKey('reply-1');

    expect(second).toBe(first);
  });

  // The other half: two deliberate attempts must NOT collapse into one external send.
  it('differs for a different attempt', () => {
    expect(deriveProviderIdempotencyKey('reply-1')).not.toBe(
      deriveProviderIdempotencyKey('reply-2'),
    );
  });

  // Resend caps the key at 256 characters; a UUIDv7 leaves the result an order of magnitude inside
  // it. Asserted so a future prefix change cannot silently produce a key the provider rejects.
  it('stays well inside the provider’s 256-character limit', () => {
    expect(
      deriveProviderIdempotencyKey('0192f3a0-0000-7000-8000-00000000abcd')
        .length,
    ).toBeLessThan(256);
  });
});

describe('isWithinProviderIdempotencyWindow', () => {
  const createdAt = new Date('2026-02-01T00:00:00.000Z');
  const after = (ms: number): Date => new Date(createdAt.getTime() + ms);

  it('is 24 hours', () => {
    expect(PROVIDER_IDEMPOTENCY_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });

  // Both sides of the boundary, to the millisecond. `>=` refuses at expiry, so the last eligible
  // instant is one millisecond before it — a test that only checked "23h yes, 25h no" would pass
  // against an off-by-an-hour comparison.
  it.each([
    ['the instant it was claimed', 0, true],
    ['one millisecond before expiry', PROVIDER_IDEMPOTENCY_WINDOW_MS - 1, true],
    ['exactly at expiry', PROVIDER_IDEMPOTENCY_WINDOW_MS, false],
    ['one millisecond after expiry', PROVIDER_IDEMPOTENCY_WINDOW_MS + 1, false],
    ['long after expiry', 30 * 24 * 60 * 60 * 1000, false],
  ])('%s → %s', (_label, offset, expected) => {
    expect(isWithinProviderIdempotencyWindow(createdAt, after(offset))).toBe(
      expected,
    );
  });

  // A clock that has gone backwards (NTP correction, a replica read) must not be read as "expired"
  // — that would refuse a recovery that is in fact safe. Negative elapsed time is inside the window.
  it('treats a backwards clock as inside the window rather than expired', () => {
    expect(isWithinProviderIdempotencyWindow(createdAt, after(-60_000))).toBe(
      true,
    );
  });
});
