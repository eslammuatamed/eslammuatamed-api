import { ValidationProblemException } from '../../common/http/validation-problem.exception';
import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  IDEMPOTENCY_KEY_MIN_LENGTH,
  IdempotencyKeyPipe,
} from './idempotency-key.pipe';

describe('IdempotencyKeyPipe', () => {
  const pipe = new IdempotencyKeyPipe();

  it('accepts a UUID, the obvious client choice', () => {
    const key = '0192f3a0-1111-7000-8000-0123456789ab';

    expect(pipe.transform(key)).toBe(key);
  });

  it('accepts a base64url token', () => {
    const key = 'aGVsbG8td29ybGQtdG9rZW4';

    expect(pipe.transform(key)).toBe(key);
  });

  // The key is compared byte-for-byte, so the pipe must not rewrite it. Trimming would make two
  // clients that disagree about whitespace collide on one logical attempt.
  it('returns the value unchanged rather than normalizing it', () => {
    const key = 'AbC-123_xyz.~';

    expect(pipe.transform(key)).toBe(key);
  });

  // Required, not optional (D10-21b): an optional idempotency guarantee is not a guarantee, and the
  // client most likely to double-send is the one whose request omitted the header.
  it.each([
    ['absent', undefined],
    ['null', null],
    ['empty string', ''],
    ['a non-string', 42],
  ])('rejects a %s header', (_label, value) => {
    expect(() => pipe.transform(value)).toThrow(ValidationProblemException);
  });

  it.each([
    ['shorter than the minimum', 'a'.repeat(IDEMPOTENCY_KEY_MIN_LENGTH - 1)],
    ['longer than the maximum', 'a'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1)],
  ])('rejects a key %s', (_label, value) => {
    expect(() => pipe.transform(value)).toThrow(ValidationProblemException);
  });

  it.each([
    ['exactly the minimum', 'a'.repeat(IDEMPOTENCY_KEY_MIN_LENGTH)],
    ['exactly the maximum', 'a'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH)],
  ])('accepts a key %s length', (_label, value) => {
    expect(pipe.transform(value)).toBe(value);
  });

  // CR/LF is the load-bearing rejection: this value is client-controlled and reaches log lines
  // and the database, and a newline
  // in a header is the classic injection vector (doc 19 §6). Excluded at the boundary rather than
  // scrubbed at the point of use, so no future call site can forget to scrub it.
  it.each([
    ['a carriage return', 'key-0001\rBcc:attacker@example.com'],
    ['a line feed', 'key-0001\nBcc:attacker@example.com'],
    ['a CRLF pair', 'key-0001\r\nBcc:attacker@example.com'],
    ['an interior space', 'key 0001 with spaces'],
    ['a tab', 'key-0001\tvalue'],
    ['a non-ASCII character', 'key-0001-مفتاح'],
  ])('rejects a key containing %s', (_label, value) => {
    expect(() => pipe.transform(value)).toThrow(ValidationProblemException);
  });

  it('reports the failure against the header name so the client can address it', () => {
    let thrown: ValidationProblemException | undefined;
    try {
      pipe.transform(undefined);
    } catch (error: unknown) {
      thrown = error as ValidationProblemException;
    }

    expect(thrown?.fieldErrors).toEqual([
      { field: IDEMPOTENCY_KEY_HEADER, message: expect.any(String) },
    ]);
  });

  // The rejected value is client-chosen and travels into logs.
  // Reflecting it would put unvalidated input on a response for no diagnostic gain.
  it('never echoes the rejected value back to the client', () => {
    const hostile = 'x\r\nBcc:attacker@example.com';
    let thrown: ValidationProblemException | undefined;
    try {
      pipe.transform(hostile);
    } catch (error: unknown) {
      thrown = error as ValidationProblemException;
    }

    const serialized = JSON.stringify(thrown?.fieldErrors);
    expect(serialized).not.toContain('attacker@example.com');
    expect(serialized).not.toContain('Bcc');
  });
});
