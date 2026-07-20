import { maskUrlToken } from './pino-logger.config';

// Guards constitution rule 5 / doc 19 §7: the preview `?token=` capability secret (D19-7)
// must never survive into a log line via pino-http's auto-logged request URL.
describe('maskUrlToken', () => {
  it('masks a token as the sole query param', () => {
    expect(maskUrlToken('/api/v1/preview/articles/abc?token=SECRET')).toBe(
      '/api/v1/preview/articles/abc?token=[Redacted]',
    );
  });

  it('masks a token as a leading query param, keeping later params', () => {
    expect(
      maskUrlToken('/api/v1/preview/articles/abc?token=SECRET&locale=en'),
    ).toBe('/api/v1/preview/articles/abc?token=[Redacted]&locale=en');
  });

  it('masks a token appearing after another param (&token=)', () => {
    expect(
      maskUrlToken('/api/v1/preview/projects/abc?locale=en&token=SECRET'),
    ).toBe('/api/v1/preview/projects/abc?locale=en&token=[Redacted]');
  });

  it('masks up to a fragment boundary', () => {
    expect(maskUrlToken('/x?token=SECRET#frag')).toBe(
      '/x?token=[Redacted]#frag',
    );
  });

  it('is case-insensitive on the param name', () => {
    expect(maskUrlToken('/x?TOKEN=SECRET')).toBe('/x?TOKEN=[Redacted]');
  });

  it('does not mask a param whose name merely starts with token', () => {
    expect(maskUrlToken('/x?tokenish=keepme')).toBe('/x?tokenish=keepme');
  });

  it('does not mask a literal "token=" inside another value', () => {
    expect(maskUrlToken('/x?note=token=abc')).toBe('/x?note=token=abc');
  });

  it('leaves a URL with no token untouched', () => {
    expect(maskUrlToken('/api/v1/articles/my-slug?locale=ar')).toBe(
      '/api/v1/articles/my-slug?locale=ar',
    );
  });

  it('passes through undefined', () => {
    expect(maskUrlToken(undefined)).toBeUndefined();
  });
});
