import {
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { THROTTLE_TIERS } from './throttle-tiers';

// Route-local abuse control for the public POST /contact intake (doc 19 §6, D02-1): 3 requests per
// hour AND 10 per day, keyed by the trusted client IP. Applied with @UseGuards on the route so it is
// NOT a globally-registered throttler — it must never touch any other route (the global
// ThrottlerGuard keeps applying only its own per-IP public tier elsewhere).
//
// The guard carries its OWN two named windows via the public constructor instead of the app-wide
// throttler options, so the global guard never sees these tiers. Each window counts in its own
// storage bucket (distinct throttler name), so the two windows are independent of each other and of
// the global public tier. It reuses the shared, globally-provided ThrottlerStorage so limits are
// consistent process-wide.
//
// BOTH windows are enforced on every request: the base ThrottlerGuard iterates all configured
// throttlers and blocks if ANY is exceeded (canActivate returns `continues.every(...)`), so the 4th
// request within the hour and the 11th within the day each yield a 429.
@Injectable()
export class ContactThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    // Reflector is injected by token: mixing @InjectThrottlerStorage (an interface-typed param) with
    // a type-only Reflector param confuses Nest's type-based resolution, so it is made explicit.
    @Inject(Reflector) reflector: Reflector,
  ) {
    const options: ThrottlerModuleOptions = [
      {
        name: 'contact-hourly',
        ttl: THROTTLE_TIERS.contactHourly.ttl,
        limit: THROTTLE_TIERS.contactHourly.limit,
      },
      {
        name: 'contact-daily',
        ttl: THROTTLE_TIERS.contactDaily.ttl,
        limit: THROTTLE_TIERS.contactDaily.limit,
      },
    ];
    super(options, storageService, reflector);
  }

  // Key both windows by the trusted client IP alone — POST /contact is @Public(), so there is no
  // authenticated user to fold into the bucket. `req.ip` is the reverse-proxy-resolved client IP in
  // production (main.ts sets `trust proxy`, doc 19 §11) — the same trusted-IP source the upload
  // guard reads, never a spoofable header. If it is absent the client cannot be identified, so the
  // guard FAILS CLOSED (503) rather than degrade to a single shared, unkeyed bucket. The rejected
  // promise (not a sync throw) surfaces through the base flow's `await getTracker` as problem+json.
  protected override getTracker(req: Request): Promise<string> {
    const ip = req.ip;
    if (!ip) {
      return Promise.reject(
        new ServiceUnavailableException(
          'A trusted client IP is required to rate-limit the contact endpoint.',
        ),
      );
    }
    return Promise.resolve(`ip:${ip}`);
  }

  // The base guard suffixes its rate-limit headers with the throttler name, so a blocked hourly
  // window emits `Retry-After-contact-hourly` and a blocked daily window `Retry-After-contact-daily`
  // instead of the standard header. doc 19 §6 requires a plain `Retry-After` on the 429, so strip
  // both suffixed variants and set the single standard header from the blocking window's
  // time-to-block-expire before delegating to the base exception (the 429 the RFC 7807 filter
  // renders as problem+json).
  protected override async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const res = context.switchToHttp().getResponse<Response>();
    res.removeHeader('Retry-After-contact-hourly');
    res.removeHeader('Retry-After-contact-daily');
    res.header('Retry-After', String(throttlerLimitDetail.timeToBlockExpire));
    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
