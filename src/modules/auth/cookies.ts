import type { CookieOptions } from 'express';
import { AppConfigService } from '../../config/app-config.service';

// The refresh cookie is scoped to the auth path only (D19-3): the browser attaches it to
// /api/v1/auth/* requests and nowhere else, minimizing its exposure surface.
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

// httpOnly (no JS access), Secure in production, SameSite=Lax (same-site topology — D19-3).
export function refreshCookieOptions(
  config: AppConfigService,
  expiresAt: Date,
): CookieOptions {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    domain: config.auth.cookieDomain,
    expires: expiresAt,
  };
}

export function clearRefreshCookieOptions(
  config: AppConfigService,
): CookieOptions {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    domain: config.auth.cookieDomain,
  };
}
