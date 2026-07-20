import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppConfigService } from '../../config/app-config.service';

// A preview token binds exactly one (entityType, entityId) pair (doc 19 §8, D19-7), so an
// article token can never unlock a project — the MAC covers the type.
export type PreviewEntityType = 'article' | 'project';

export interface MintedPreviewToken {
  readonly token: string;
  readonly expiresAt: Date;
}

// 30-minute expiry bounds exposure of a leaked draft link (doc 19 §8, D19-7).
const TOKEN_TTL_MS = 30 * 60 * 1000;

// Stateless HMAC preview tokens (D19-7): mac = HMAC_SHA256(secret, `${entityType}:${entityId}:${exp}`),
// wire format `base64url(exp).base64url(mac)`, no DB state (nothing to store or revoke; expiry bounds
// the leak). `verify` is the trust boundary for draft visibility, so it MUST NEVER THROW — any
// malformed / garbage / wrong-length token returns `false` (→ the caller's 404), never a 500. Token
// values are never logged. The secret is read only through AppConfigService (doc 19 §7).
@Injectable()
export class PreviewTokenService {
  constructor(private readonly config: AppConfigService) {}

  mint(entityType: PreviewEntityType, entityId: string): MintedPreviewToken {
    const exp = Date.now() + TOKEN_TTL_MS;
    const mac = this.computeMac(entityType, entityId, exp);
    const token = `${encodeBase64Url(String(exp))}.${mac.toString('base64url')}`;
    return { token, expiresAt: new Date(exp) };
  }

  verify(
    entityType: PreviewEntityType,
    entityId: string,
    token: string,
  ): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 2) return false;
      const [expPart, macPart] = parts;
      if (expPart === undefined || macPart === undefined) return false;

      const exp = Number(decodeBase64Url(expPart));
      if (!Number.isFinite(exp)) return false;

      // Recompute the MAC over the token's own `exp`: a tampered expiry produces a MAC the
      // attacker cannot forge without the secret, so tampering fails the compare below.
      const expectedMac = this.computeMac(entityType, entityId, exp);
      const providedMac = Buffer.from(macPart, 'base64url');

      // timingSafeEqual throws on length-mismatched buffers — guard first so a truncated or
      // garbage MAC returns false instead of throwing.
      if (providedMac.length !== expectedMac.length) return false;
      if (!timingSafeEqual(expectedMac, providedMac)) return false;

      // MAC is authentic; fail closed at exact expiry.
      return exp > Date.now();
    } catch {
      // Any parse/crypto failure means the token is invalid, not that the server errored.
      return false;
    }
  }

  private computeMac(
    entityType: PreviewEntityType,
    entityId: string,
    exp: number,
  ): Buffer {
    return createHmac('sha256', this.config.auth.previewTokenSecret)
      .update(`${entityType}:${entityId}:${exp}`)
      .digest();
  }
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}
