import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { UploadUserIpThrottlerGuard } from './upload-user-ip-throttler.guard';

// getTracker composes the rate-limit bucket key and never touches storage, so an empty stub is
// enough to exercise it in isolation (no onModuleInit needed for this method).
const storageStub = {} as ThrottlerStorage;

interface TrackableRequest {
  ip?: string;
  user?: { id: string };
}

// getTracker is protected — the class contract under test is the (user, IP) bucket key it emits.
function trackerOf(req: TrackableRequest): Promise<string> {
  const guard = new UploadUserIpThrottlerGuard(storageStub, new Reflector());
  return (
    guard as unknown as { getTracker(r: TrackableRequest): Promise<string> }
  ).getTracker(req);
}

describe('UploadUserIpThrottlerGuard tracker (doc 19 §6, Q3/D19-9)', () => {
  it('keys the bucket by the authenticated user AND their IP', async () => {
    expect(await trackerOf({ user: { id: 'u1' }, ip: '10.0.0.1' })).toBe(
      'user:u1|ip:10.0.0.1',
    );
  });

  it('gives two different users on the SAME IP separate buckets', async () => {
    const a = await trackerOf({ user: { id: 'u1' }, ip: '10.0.0.1' });
    const b = await trackerOf({ user: { id: 'u2' }, ip: '10.0.0.1' });
    expect(a).not.toBe(b);
  });

  it('gives one user on two IPs separate buckets', async () => {
    const a = await trackerOf({ user: { id: 'u1' }, ip: '10.0.0.1' });
    const b = await trackerOf({ user: { id: 'u1' }, ip: '10.0.0.2' });
    expect(a).not.toBe(b);
  });

  it('fails closed (throws an auth error) when no authenticated user is present — never IP-only', async () => {
    // request.user is absent only if this guard ran out of order (it sits behind the global auth +
    // permission guards). Degrading to an IP-only bucket would silently weaken the control, so the
    // tracker rejects with an authentication error instead.
    await expect(trackerOf({ ip: '10.0.0.1' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(trackerOf({})).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
