import {
  createParamDecorator,
  ExecutionContext,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import type { Request } from 'express';
import { ValidationProblemException } from '../../common/http/validation-problem.exception';

// The header's contract (D10-21b). Bounded and opaque: the API never parses this value, it only
// stores and compares it, so the only properties worth enforcing are that it exists, that it cannot
// be used to smuggle anything into a header or a log line, and that it cannot be unbounded.
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const IDEMPOTENCY_KEY_MIN_LENGTH = 8;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 200;

// Printable ASCII, no whitespace. A UUID, a ULID and a base64url token all satisfy it. CR/LF are
// excluded by construction — the same header-injection reasoning as `singleLine` in
// contact-mail.service.ts, applied at the boundary instead of at the point of use, because in 11B
// this value becomes a provider idempotency header and a newline in a header is the classic
// injection vector (doc 19 §6).
const OPAQUE_KEY = /^[\x21-\x7e]+$/;

// Extracts the raw `Idempotency-Key` header.
//
// A custom param decorator rather than Nest's `@Headers('idempotency-key')`, for one mechanical
// reason: `@Headers` takes no pipe argument, while a custom decorator does — so this is what lets the
// validation below run as a PIPE, ahead of the handler, rather than as a check inside it. Header
// names are lower-cased by Node's HTTP parser, so the lookup is the lower-case form regardless of
// how the client cased it.
//
// It extracts and nothing else; every rule about the value lives in `IdempotencyKeyPipe`, so there
// is one place to read to know what the header must be.
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): unknown =>
    ctx.switchToHttp().getRequest<Request>().headers['idempotency-key'],
);

// Validates the `Idempotency-Key` request header (D10-21b).
//
// A pipe rather than a check inside the service: the global ValidationPipe never sees a header, so
// without this the header would be validated somewhere that already has a database connection and a
// message row in hand — the wrong place to discover the request was malformed. Failing here keeps
// the ordering the contract promises: a bad request is answered before any row is read or claimed.
//
// It throws the same `ValidationProblemException` the body pipe throws, so a missing header and a
// missing body field produce ONE problem shape with an addressable field path, rather than two
// different error vocabularies for the same class of mistake.
@Injectable()
export class IdempotencyKeyPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw this.reject('The Idempotency-Key header is required.');
    }

    // Not trimmed: the key is opaque and compared byte-for-byte, so silently rewriting it would
    // make two clients that disagree about whitespace collide on one logical attempt.
    if (
      value.length < IDEMPOTENCY_KEY_MIN_LENGTH ||
      value.length > IDEMPOTENCY_KEY_MAX_LENGTH
    ) {
      throw this.reject(
        `The Idempotency-Key header must be between ${IDEMPOTENCY_KEY_MIN_LENGTH} and ` +
          `${IDEMPOTENCY_KEY_MAX_LENGTH} characters.`,
      );
    }

    if (!OPAQUE_KEY.test(value)) {
      throw this.reject(
        'The Idempotency-Key header must contain only printable ASCII characters and no whitespace.',
      );
    }

    return value;
  }

  // The rejected value is never echoed back. It is client-chosen and travels into a log line and,
  // in 11B, a provider header; reflecting it would put unvalidated input on a response for no
  // diagnostic gain the message does not already give.
  private reject(message: string): ValidationProblemException {
    return new ValidationProblemException([
      { field: IDEMPOTENCY_KEY_HEADER, message },
    ]);
  }
}
