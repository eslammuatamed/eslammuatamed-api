import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

// The single source of truth for the app's CORS policy (doc 19 §2), so the e2e lane asserts the
// same object main.ts installs rather than a hand-copied approximation.
//
// `Retry-After` must be declared explicitly: the CORS-safelisted response headers a browser exposes
// without being told are only Cache-Control, Content-Language, Content-Length, Content-Type,
// Expires, Last-Modified and Pragma. Without this entry the throttler's header is sent but reads as
// `null` in browser JS, so the one client the value exists for cannot see it — an unreadable header
// is an undelivered one (doc 19 §2, doc 10 §3, D10-15). Exposure is minimal and deliberate:
// `Retry-After` carries no identity, session or user data, and nothing else is exposed.
export const EXPOSED_HEADERS: readonly string[] = ['Retry-After'];

export function buildCorsOptions(origin: string): CorsOptions {
  return {
    origin,
    credentials: true,
    exposedHeaders: [...EXPOSED_HEADERS],
  };
}
