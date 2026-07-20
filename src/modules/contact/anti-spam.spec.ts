import { isSpam, MIN_FILL_MS } from './anti-spam';

describe('isSpam', () => {
  const goodElapsed = MIN_FILL_MS + 5000;

  it('passes a genuine submission: empty honeypot + human fill time', () => {
    expect(isSpam({ website: '', elapsedMs: goodElapsed })).toBe(false);
    expect(isSpam({ elapsedMs: goodElapsed })).toBe(false);
  });

  it('flags a filled honeypot regardless of fill time', () => {
    expect(
      isSpam({ website: 'http://bot.example', elapsedMs: goodElapsed }),
    ).toBe(true);
  });

  it('flags a whitespace-only honeypot as filled', () => {
    expect(isSpam({ website: '   ', elapsedMs: goodElapsed })).toBe(true);
  });

  it('flags a fill time below the human threshold', () => {
    expect(isSpam({ elapsedMs: MIN_FILL_MS - 1 })).toBe(true);
  });

  it('flags an absent fill time', () => {
    expect(isSpam({})).toBe(true);
    expect(isSpam({ website: '' })).toBe(true);
  });

  it('flags a negative fill time', () => {
    expect(isSpam({ elapsedMs: -1 })).toBe(true);
  });

  it('passes at exactly the threshold (>= is human)', () => {
    expect(isSpam({ elapsedMs: MIN_FILL_MS })).toBe(false);
  });
});
