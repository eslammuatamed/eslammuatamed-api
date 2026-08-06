import { AppConfigService } from '../../config/app-config.service';
import { PreviewTokenService } from './preview-token.service';

// Only `auth.previewTokenSecret` is read, so a plain typed stub is sufficient — the same
// direct-construction pattern used by refresh-token.service.spec.ts (jest-mock-extended is only
// needed there for PrismaService; PreviewTokenService has no Prisma dependency).
const config = {
  auth: { previewTokenSecret: 'test-preview-secret-value' },
} as AppConfigService;

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

describe('PreviewTokenService', () => {
  let service: PreviewTokenService;

  beforeEach(() => {
    service = new PreviewTokenService(config);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('mint + verify round-trip', () => {
    it('verifies a freshly minted token for the same entity', () => {
      const { token } = service.mint('article', 'article-1');

      expect(service.verify('article', 'article-1', token)).toBe(true);
    });

    it('emits the two-part base64url wire format `base64url(exp).base64url(mac)`', () => {
      const { token } = service.mint('project', 'project-1');
      const parts = token.split('.');

      expect(parts).toHaveLength(2);
      // base64url alphabet only (no `+`, `/`, or `=` padding).
      expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    });

    it('sets `expiresAt` exactly 30 minutes ahead of mint time', () => {
      jest.useFakeTimers();
      const now = new Date('2026-07-20T12:00:00.000Z');
      jest.setSystemTime(now);

      const { expiresAt } = service.mint('article', 'article-1');

      expect(expiresAt.getTime()).toBe(now.getTime() + THIRTY_MINUTES_MS);
    });
  });

  describe('verify rejects invalid tokens', () => {
    it('returns false once the token has expired', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-07-20T12:00:00.000Z'));
      const { token } = service.mint('article', 'article-1');

      // Advance one minute past the 30-minute expiry.
      jest.setSystemTime(new Date('2026-07-20T12:31:00.000Z'));

      expect(service.verify('article', 'article-1', token)).toBe(false);
    });

    it('returns false for a tampered MAC (same length, altered bytes)', () => {
      const { token } = service.mint('article', 'article-1');
      const dotIndex = token.indexOf('.');
      const expPart = token.slice(0, dotIndex);
      const macPart = token.slice(dotIndex + 1);
      // Flip the FIRST macPart char (byte 0 always changes) — mutating the final char can decode
      // to the identical 32 bytes since it only carries 4 meaningful bits.
      const flipped = (macPart.startsWith('A') ? 'B' : 'A') + macPart.slice(1);
      const tampered = `${expPart}.${flipped}`;

      expect(service.verify('article', 'article-1', tampered)).toBe(false);
    });

    it('returns false for a token minted for a different entityType (cross-type)', () => {
      const { token } = service.mint('article', 'shared-id');

      expect(service.verify('project', 'shared-id', token)).toBe(false);
    });

    it('returns false for a token minted for a different entityId', () => {
      const { token } = service.mint('article', 'article-1');

      expect(service.verify('article', 'article-2', token)).toBe(false);
    });

    it('returns false when the exp part is extended but the MAC is kept (MAC binds exp, D19-7)', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-07-20T12:00:00.000Z'));
      const { token } = service.mint('article', 'article-1');
      const macPart = token.slice(token.indexOf('.') + 1);

      // Forge: swap in a far-future exp while reusing the original MAC. Because the MAC covers
      // `exp`, verify recomputes over the forged exp and the compare fails — the token cannot be
      // silently extended. (Guards against an exp-dropped-from-message regression.)
      const forgedExp = Date.now() + 24 * 60 * 60 * 1000;
      const forged = `${Buffer.from(String(forgedExp)).toString('base64url')}.${macPart}`;

      expect(service.verify('article', 'article-1', forged)).toBe(false);
    });
  });

  describe('verify never throws on malformed input', () => {
    const garbage = [
      '',
      'not-a-token',
      'onlyonepart',
      'a.b.c', // too many parts
      'a.b', // length-mismatched MAC (1 byte vs 32) — would throw in timingSafeEqual if unguarded
      '!!!.@@@', // non-base64url characters
      '.', // two empty parts
      'ZXhw.', // empty MAC part
    ];

    it.each(garbage)('returns false without throwing for %p', (token) => {
      expect(() => service.verify('article', 'article-1', token)).not.toThrow();
      expect(service.verify('article', 'article-1', token)).toBe(false);
    });
  });
});
