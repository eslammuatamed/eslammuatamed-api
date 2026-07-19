import {
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
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
import { AuthenticatedUser } from '../auth/authenticated-user';
import { THROTTLE_TIERS } from './throttle-tiers';

// Route-local upload throttle for POST /admin/media (doc 19 §6, Q3/D19-9): 10 requests per minute
// keyed by the authenticated user *and* their IP. Applied with @UseGuards on the route so it runs
// AFTER the global JwtAuthGuard + PermissionsGuard (route guards run after the app-wide guards) —
// that is the only point at which request.user exists. The global ThrottlerGuard deliberately runs
// before authentication (so it also covers @Public routes), which is exactly why it cannot key by
// user and this route-local guard is needed.
//
// The guard carries its OWN single 'media-upload' tier via the public constructor instead of the
// app-wide throttler options, so the global guard never sees this tier. The two guards therefore
// write to independent buckets (distinct throttler name AND tracker → distinct storage keys): the
// upload tier is counted exactly once here, with no double counting against the per-IP admin tier
// the global guard keeps applying to this admin route. It reuses the shared, globally-provided
// ThrottlerStorage so limits are consistent process-wide.
@Injectable()
export class UploadUserIpThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    // Reflector is injected by token: mixing @InjectThrottlerStorage (an interface-typed param) with
    // a type-only Reflector param confuses Nest's type-based resolution, so it is made explicit.
    @Inject(Reflector) reflector: Reflector,
  ) {
    const options: ThrottlerModuleOptions = [
      {
        name: 'media-upload',
        ttl: THROTTLE_TIERS.upload.ttl,
        limit: THROTTLE_TIERS.upload.limit,
      },
    ];
    super(options, storageService, reflector);
  }

  // Compose the bucket key from the authenticated user id AND the trusted client IP (req.ip is honest
  // behind the reverse proxy in production — main.ts sets `trust proxy`, doc 19 §11). This route runs
  // behind the global JwtAuthGuard + PermissionsGuard, so request.user (and a trusted IP) are always
  // present here. Their absence is a guard-order/wiring failure, so the guard FAILS CLOSED with an
  // authentication error — it never degrades to an IP-only or partial bucket (doc 19 §3/§6,
  // D19-8/D19-9). The only accepted key is `user:<authenticated-user-id>|ip:<trusted-request-ip>`.
  protected override getTracker(
    req: Request & { user?: AuthenticatedUser },
  ): Promise<string> {
    const userId = req.user?.id;
    const ip = req.ip;
    if (!userId || !ip) {
      // Rejected promise (not a sync throw): the base flow awaits getTracker, so this surfaces as a
      // 401 problem+json; a sync throw would bypass that await path.
      return Promise.reject(
        new UnauthorizedException(
          'Authentication context is required for the media upload throttle.',
        ),
      );
    }
    return Promise.resolve(`user:${userId}|ip:${ip}`);
  }

  // The base guard suffixes its rate-limit headers with the throttler name, so this tier would emit
  // `Retry-After-media-upload` instead of the standard header. Q3 requires a plain `Retry-After` on
  // the 429, so it is set here before delegating to the base exception (which throws the 429 the
  // RFC 7807 filter renders as problem+json).
  protected override async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const res = context.switchToHttp().getResponse<Response>();
    // The base guard already emitted a name-suffixed `Retry-After-media-upload`; replace it with the
    // single standard header so clients get exactly one, spec-compliant Retry-After.
    res.removeHeader('Retry-After-media-upload');
    res.header('Retry-After', String(throttlerLimitDetail.timeToBlockExpire));
    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
