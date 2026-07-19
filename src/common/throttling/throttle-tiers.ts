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
} as const;
