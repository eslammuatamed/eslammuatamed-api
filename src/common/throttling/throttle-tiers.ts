// Rate-limit tiers (doc 19 §6), in @nestjs/throttler shape (ttl in ms). The global default
// is the public-read tier; auth and admin routes override it locally via @Throttle.
export const THROTTLE_TIERS = {
  public: { ttl: 60_000, limit: 120 }, // 120 / min
  admin: { ttl: 60_000, limit: 300 }, // 300 / min
  login: { ttl: 900_000, limit: 5 }, // 5 / 15 min
  refresh: { ttl: 3_600_000, limit: 30 }, // 30 / hour
  // POST /admin/media only — the conservative upload cap (doc 19 §6, Q3/D19-9). Enforced by the
  // route-local UploadUserIpThrottlerGuard keyed by authenticated user + IP, not the global
  // IP-only guard, so it is not one of the tiers the global ThrottlerGuard applies.
  upload: { ttl: 60_000, limit: 10 }, // 10 / min per authenticated user + IP
  // POST /contact only — the public contact intake abuse cap (doc 19 §6, D02-1). Both windows are
  // enforced together (3 / hour AND 10 / day per IP) by the route-local ContactThrottlerGuard keyed
  // by the trusted client IP and applied via @UseGuards, not the global IP-only guard, so these are
  // not tiers the global ThrottlerGuard applies.
  contactHourly: { ttl: 3_600_000, limit: 3 }, // 3 / hour per IP
  contactDaily: { ttl: 86_400_000, limit: 10 }, // 10 / day per IP
} as const;
