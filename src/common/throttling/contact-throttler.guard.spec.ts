import {
  ExecutionContext,
  INestApplication,
  Controller,
  Module,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  ThrottlerException,
  ThrottlerModule,
  ThrottlerStorage,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppConfigService } from '../../config/app-config.service';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { PROBLEM_TYPES } from '../http/problem-details';
import { UploadUserIpThrottlerGuard } from './upload-user-ip-throttler.guard';
import { ContactThrottlerGuard } from './contact-throttler.guard';
import { THROTTLE_TIERS } from './throttle-tiers';

// --- Test doubles for the ExecutionContext the guard reads ---------------------------------------

interface MockResponse {
  readonly headers: Record<string, string>;
  header(name: string, value: string | number): MockResponse;
  removeHeader(name: string): void;
}

// Mirrors the case-insensitive header store the guard relies on: the base guard sets a name-suffixed
// `Retry-After-contact-*` and the override removes it and sets a plain `Retry-After`.
function makeResponse(): MockResponse {
  const headers: Record<string, string> = {};
  const res: MockResponse = {
    headers,
    header(name: string, value: string | number): MockResponse {
      headers[name.toLowerCase()] = String(value);
      return res;
    },
    removeHeader(name: string): void {
      delete headers[name.toLowerCase()];
    },
  };
  return res;
}

// Stable handler/class references so the throttler's storage key (derived from their names) is
// identical across requests with the same IP, i.e. they share one bucket per window.
class ContactController {}
function submit(): void {}

function makeContext(
  ip: string | undefined,
  res: MockResponse,
): ExecutionContext {
  const req = { ip, headers: {} as Record<string, string> };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
    getHandler: () => submit,
    getClass: () => ContactController,
  } as unknown as ExecutionContext;
}

// getTracker is protected — the contract under test is the per-IP bucket key it emits.
interface TrackableRequest {
  ip?: string;
}

function contactTrackerOf(req: TrackableRequest): Promise<string> {
  const guard = new ContactThrottlerGuard(
    {} as ThrottlerStorage,
    new Reflector(),
  );
  return (
    guard as unknown as { getTracker(r: TrackableRequest): Promise<string> }
  ).getTracker(req);
}

function uploadTrackerOf(
  req: TrackableRequest & { user?: { id: string } },
): Promise<string> {
  const guard = new UploadUserIpThrottlerGuard(
    {} as ThrottlerStorage,
    new Reflector(),
  );
  return (
    guard as unknown as { getTracker(r: TrackableRequest): Promise<string> }
  ).getTracker(req);
}

// -------------------------------------------------------------------------------------------------

describe('ContactThrottlerGuard tracker (doc 19 §6, D02-1)', () => {
  it('keys the bucket by the trusted client IP', async () => {
    expect(await contactTrackerOf({ ip: '10.0.0.1' })).toBe('ip:10.0.0.1');
  });

  it('gives two different IPs separate buckets', async () => {
    const a = await contactTrackerOf({ ip: '10.0.0.1' });
    const b = await contactTrackerOf({ ip: '10.0.0.2' });
    expect(a).not.toBe(b);
  });

  it('resolves the same trusted IP (req.ip) as the upload guard', async () => {
    // Both route-local guards read the reverse-proxy-resolved req.ip as their trusted-IP source; the
    // contact guard keys on it alone (public route, no user), the upload guard folds it into the
    // user+IP key. The shared invariant under test is that the IP segment comes from req.ip.
    const req = { ip: '203.0.113.7', user: { id: 'u1' } };
    expect(await contactTrackerOf(req)).toBe('ip:203.0.113.7');
    expect(await uploadTrackerOf(req)).toContain('ip:203.0.113.7');
  });

  it('fails closed (503) when no trusted IP is present — never an unkeyed bucket', async () => {
    await expect(contactTrackerOf({})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe('ContactThrottlerGuard windows (canActivate over real storage)', () => {
  let storage: ThrottlerStorageService;
  let guard: ContactThrottlerGuard;

  beforeEach(async () => {
    storage = new ThrottlerStorageService();
    guard = new ContactThrottlerGuard(storage, new Reflector());
    // Populates the sorted throttler list + tracker binding the base guard reads in canActivate.
    await guard.onModuleInit();
  });

  afterEach(() => {
    // Each hit schedules a far-future setTimeout in the in-memory store; clear them so the pending
    // timers do not leak as open handles (and reset any fake timers a test switched on).
    storage.onApplicationShutdown();
    jest.useRealTimers();
  });

  it('allows 3 requests in the hour but returns 429 on the 4th (hourly window)', async () => {
    const res = makeResponse();
    const ip = '198.51.100.1';
    const { limit } = THROTTLE_TIERS.contactHourly;

    for (let i = 0; i < limit; i++) {
      await expect(guard.canActivate(makeContext(ip, res))).resolves.toBe(true);
    }
    await expect(
      guard.canActivate(makeContext(ip, res)),
    ).rejects.toBeInstanceOf(ThrottlerException);

    // The 429 carries a single, standard Retry-After — the name-suffixed variants are stripped.
    expect(res.headers['retry-after']).toBeDefined();
    expect(res.headers['retry-after-contact-hourly']).toBeUndefined();
    expect(res.headers['retry-after-contact-daily']).toBeUndefined();
  });

  it('keeps per-IP buckets independent — one IP at its cap does not throttle another', async () => {
    const busy = '198.51.100.2';
    const { limit } = THROTTLE_TIERS.contactHourly;

    for (let i = 0; i < limit; i++) {
      await expect(
        guard.canActivate(makeContext(busy, makeResponse())),
      ).resolves.toBe(true);
    }
    await expect(
      guard.canActivate(makeContext(busy, makeResponse())),
    ).rejects.toBeInstanceOf(ThrottlerException);

    // A different IP is unaffected: its first request still passes.
    await expect(
      guard.canActivate(makeContext('198.51.100.3', makeResponse())),
    ).resolves.toBe(true);
  });

  it('allows 10 requests across the day but returns 429 on the 11th (daily window)', async () => {
    jest.useFakeTimers();
    const res = makeResponse();
    const ip = '198.51.100.9';
    const hourMs = THROTTLE_TIERS.contactHourly.ttl;

    // Spread 9 requests across three hour-separated batches so the hourly window (3) never trips —
    // only the daily counter (10) accumulates. Advancing past the hour fires the hourly buckets'
    // expiry timers (Date is faked by modern timers), leaving the day-long buckets intact.
    for (let batch = 0; batch < 3; batch++) {
      for (let i = 0; i < 3; i++) {
        await expect(guard.canActivate(makeContext(ip, res))).resolves.toBe(
          true,
        );
      }
      jest.advanceTimersByTime(hourMs + 1);
    }

    // 10th request in the day — still allowed.
    await expect(guard.canActivate(makeContext(ip, res))).resolves.toBe(true);
    // 11th request in the day — the daily window is exceeded → 429.
    await expect(
      guard.canActivate(makeContext(ip, res)),
    ).rejects.toBeInstanceOf(ThrottlerException);
  });
});

// StubContactController exposes one guarded route and one unguarded route so the HTTP suite can prove
// the guard is route-local (@UseGuards), not a globally-registered throttler that would touch every
// route. No global ThrottlerGuard is registered in this test module; forRoot only provides storage.
@Controller()
class StubContactController {
  @Post('contact')
  @UseGuards(ContactThrottlerGuard)
  submit(): { ok: true } {
    return { ok: true };
  }

  @Post('other')
  other(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 1_000 }]),
  ],
  controllers: [StubContactController],
  providers: [ContactThrottlerGuard],
})
class ContactThrottleTestModule {}

describe('ContactThrottlerGuard over HTTP (route-local, RFC 7807)', () => {
  let app: INestApplication;
  let server: App;
  const hourlyLimit = THROTTLE_TIERS.contactHourly.limit;

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(
      ContactThrottleTestModule,
      { logger: false },
    );
    // The real RFC 7807 filter so a throttled request leaves as application/problem+json. It only
    // reads config.isProduction (for 5xx sanitization), never touched on a 429 — a stub suffices.
    app.useGlobalFilters(
      new AllExceptionsFilter({ isProduction: false } as AppConfigService),
    );
    await app.init();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  it(`allows ${hourlyLimit} requests then returns a 429 problem+json with Retry-After for the same IP`, async () => {
    for (let i = 0; i < hourlyLimit; i++) {
      await request(server).post('/contact').expect(201);
    }

    const blocked = await request(server).post('/contact');
    expect(blocked.status).toBe(429);
    // RFC 7807 problem+json (doc 10 §3) + a single standard Retry-After (doc 19 §6).
    expect(blocked.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(blocked.body).toMatchObject({
      status: 429,
      type: PROBLEM_TYPES.tooManyRequests,
    });
    expect(blocked.headers['retry-after']).toBeDefined();
    // The name-suffixed variants never reach the client.
    expect(blocked.headers['retry-after-contact-hourly']).toBeUndefined();
    expect(blocked.headers['retry-after-contact-daily']).toBeUndefined();
  });

  it('never throttles a route the guard is not applied to (route-local, not global)', async () => {
    for (let i = 0; i < hourlyLimit + 5; i++) {
      await request(server).post('/other').expect(201);
    }
  });
});
