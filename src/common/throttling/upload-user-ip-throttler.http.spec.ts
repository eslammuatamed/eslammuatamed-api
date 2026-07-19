import {
  CanActivate,
  Controller,
  ExecutionContext,
  INestApplication,
  Module,
  Post,
  UseGuards,
} from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppConfigService } from '../../config/app-config.service';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { PROBLEM_TYPES } from '../http/problem-details';
import { THROTTLE_TIERS } from './throttle-tiers';
import { UploadUserIpThrottlerGuard } from './upload-user-ip-throttler.guard';

// Stands in for the global JwtAuthGuard: projects `x-test-user` onto request.user. Registered as a
// global guard so it runs BEFORE the route-local throttle guard, reproducing the real order in
// which request.user is populated before UploadUserIpThrottlerGuard reads it.
class StubAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { id: string } }>();
    const id = req.headers['x-test-user'];
    if (typeof id === 'string') {
      req.user = { id };
    }
    return true;
  }
}

@Controller('media')
class StubMediaController {
  @Post()
  @UseGuards(UploadUserIpThrottlerGuard)
  upload(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  imports: [
    // Provides the app-wide ThrottlerStorage (global module) that the route-local guard injects.
    // Its 'default' tier is irrelevant here — no global ThrottlerGuard is registered in this app.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 1_000 }]),
  ],
  controllers: [StubMediaController],
  providers: [
    UploadUserIpThrottlerGuard,
    { provide: APP_GUARD, useClass: StubAuthGuard },
  ],
})
class ThrottleTestModule {}

describe('UploadUserIpThrottlerGuard over HTTP (doc 19 §6, Q3/D19-9)', () => {
  let app: INestApplication;
  let server: App;
  const { limit } = THROTTLE_TIERS.upload;

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(ThrottleTestModule, {
      logger: false,
    });
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

  const post = (user: string): request.Test =>
    request(server).post('/media').set('x-test-user', user);

  it(`allows ${limit} uploads then returns 429 for the same user+IP`, async () => {
    const user = 'user-at-cap';
    for (let i = 0; i < limit; i++) {
      await post(user).expect(201);
    }

    const blocked = await post(user);
    expect(blocked.status).toBe(429);
    // RFC 7807 problem+json (doc 10 §3) + the throttler's Retry-After (Q3 "429 + Retry-After").
    expect(blocked.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(blocked.body).toMatchObject({
      status: 429,
      type: PROBLEM_TYPES.tooManyRequests,
    });
    expect(blocked.headers['retry-after']).toBeDefined();
    // Exactly one, standard Retry-After — the name-suffixed variant is stripped.
    expect(blocked.headers['retry-after-media-upload']).toBeUndefined();
  });

  it('gives a second user on the same IP an independent bucket', async () => {
    // Exhaust the first user's bucket…
    const first = 'user-a';
    for (let i = 0; i < limit; i++) {
      await post(first).expect(201);
    }
    await post(first).expect(429);

    // …a different user from the same IP is unaffected (per user, not per IP).
    await post('user-b').expect(201);
  });

  it('fails closed with 401 when the request carries no authenticated user', async () => {
    // The stub auth guard lets the request through without setting request.user, modeling a
    // guard-order/wiring failure. The tracker must reject with an authentication error rather than
    // fall back to an IP-only bucket — so the response is 401 problem+json, not 201/429.
    const res = await request(server).post('/media'); // no x-test-user header
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      status: 401,
      type: PROBLEM_TYPES.unauthorized,
    });
  });
});
