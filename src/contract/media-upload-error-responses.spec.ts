import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The error contract of `POST /api/v1/admin/media`, asserted over the EXPORTED document
 * (`openapi.json`, doc 16 §3) — never over decorator source.
 *
 * The upload boundary rejects two client mistakes deterministically BEFORE any service, storage,
 * or database work: a request without the required `file` part (or with the file under an
 * unexpected field name) answers 400, and a part beyond `MAX_UPLOAD_BYTES` answers 413 — both as
 * RFC 7807 `ProblemDetailsDto` from the global filter. Neither status was declared in the
 * exported operation, so a consumer building from the contract had no type for either failure.
 *
 * The 429 also carries the standard delta-seconds `Retry-After`: every reachable cause on this
 * route emits it — the default-named global tier is unsuffixed by `@nestjs/throttler`, the
 * upload guard replaces its name-suffixed header with the plain one, and the capacity interceptor
 * sets it — so the header is documented as universally guaranteed, not per-cause.
 */

const OPERATION_PATH = '/api/v1/admin/media';

interface ResponseEntry {
  readonly description?: string;
  readonly content?: Record<
    string,
    { schema?: { $ref?: string; type?: string } }
  >;
  readonly headers?: Record<string, unknown>;
}

interface Operation {
  readonly responses?: Record<string, ResponseEntry>;
}

const CONTRACT: { paths: Record<string, Record<string, unknown>> } = JSON.parse(
  readFileSync(
    // Resolved from this file's location (`src/contract/` → two levels to the repo root), so the
    // spec reads the committed contract regardless of jest's working directory.
    join(__dirname, '..', '..', 'openapi.json'),
    'utf8',
  ),
);

const PROBLEM_REF = '#/components/schemas/ProblemDetailsDto';
const PROBLEM_MEDIA_TYPE = 'application/problem+json';
const RETRY_AFTER_HEADER_NAME = 'Retry-After';

function operation(): Operation {
  const op = CONTRACT.paths[OPERATION_PATH]?.post as Operation | undefined;
  expect(op).toBeDefined();
  return op as Operation;
}

function assertProblemResponse(
  responses: Record<string, ResponseEntry>,
  status: string,
): void {
  // Each call site is a per-status test, so a missing entry or a wrong schema names the status
  // through the test title — no expect-message argument (jest 30 takes none).
  const ref = responses[status]?.content?.[PROBLEM_MEDIA_TYPE]?.schema?.$ref;
  expect(ref).toBe(PROBLEM_REF);
}

describe('exported contract — POST /admin/media error responses', () => {
  it('finds the operation and its full response set at all', () => {
    // Guards the guard: a path typo or restructured document would make every assertion below
    // vacuously true. The set is asserted exactly — adding or losing a status fails here first.
    const codes = Object.keys(operation().responses ?? {}).sort();
    expect(codes).toEqual([
      '200',
      '201',
      '400',
      '401',
      '403',
      '413',
      '422',
      '429',
    ]);
  });

  it('declares 400 as problem+json ProblemDetailsDto', () => {
    assertProblemResponse(operation().responses ?? {}, '400');
  });

  it('declares 413 as problem+json ProblemDetailsDto', () => {
    assertProblemResponse(operation().responses ?? {}, '413');
  });

  it('documents the standard Retry-After header on 429', () => {
    const responses = operation().responses ?? {};
    assertProblemResponse(responses, '429');

    // A missing header fails through the schema assertion below: `undefined` is not 'integer'.
    const header = responses['429']?.headers?.[RETRY_AFTER_HEADER_NAME] as
      | { description?: string; schema?: { type?: string; format?: string } }
      | undefined;
    expect(header?.schema?.type).toBe('integer');
    expect(header?.description).toContain('delta-seconds');
  });
});
