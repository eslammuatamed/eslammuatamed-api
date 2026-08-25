import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import {
  PROBLEM_CONTENT_TYPE,
  ProblemDetailsDto,
} from '../http/problem-details';

// Documents an RFC 7807 error response (doc 10 §3) with the shared ProblemDetails schema under
// the `application/problem+json` media type — exactly what the global exception filter emits, so
// contract assertions cover error paths too. @ApiExtraModels forces ProblemDetailsDto
// (and its nested FieldErrorDto) into components.schemas even though no body/param references it.
export function ApiProblemResponse(
  status: number,
  description: string,
  headers?: Record<string, HeaderObject>,
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(ProblemDetailsDto),
    ApiResponse({
      status,
      description,
      ...(headers ? { headers } : {}),
      content: {
        [PROBLEM_CONTENT_TYPE]: {
          schema: { $ref: getSchemaPath(ProblemDetailsDto) },
        },
      },
    }),
  );
}

// The OpenAPI header object shape `ApiResponse` accepts, narrowed to what this codebase documents.
interface HeaderObject {
  readonly description: string;
  readonly schema: Record<string, unknown>;
}

// `Retry-After` as emitted on a throttled response: delta-seconds, never an HTTP-date (doc 19 §6,
// doc 10 §3, D10-15). Documented so a consumer knows the unit, and CORS-exposed (cors.options.ts)
// so a browser client can read it — a header the client cannot see is not a contract it can use.
export const RETRY_AFTER_HEADER: Record<string, HeaderObject> = {
  'Retry-After': {
    description:
      'Seconds to wait before retrying (delta-seconds, never an HTTP-date). Exposed via CORS so browser clients can read it.',
    schema: { type: 'integer', format: 'int32', minimum: 1, example: 3600 },
  },
};

// The error set every authenticated admin route can return regardless of its body: no/invalid
// token (401), missing permission (403), and the admin throttle tier (429). Applied at the
// controller class level; per-route 404/409/422 are added on the individual handlers.
export function ApiAdminErrorResponses(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiProblemResponse(
      HttpStatus.UNAUTHORIZED,
      'Missing or invalid access token.',
    ),
    ApiProblemResponse(
      HttpStatus.FORBIDDEN,
      'Missing the required permission.',
    ),
    ApiProblemResponse(
      HttpStatus.TOO_MANY_REQUESTS,
      'Admin rate limit exceeded (300 / min).',
    ),
  );
}

// The 400 a route earns purely by parsing a UUID path parameter.
//
// A malformed `:id` answers 400, not the 422 the rest of the request surface uses. The mechanism
// is not the obvious one: Nest puts GLOBAL pipes first (`pipes.concat(paramPipes)`) and applies
// them left to right, so the global `ValidationPipe` runs BEFORE `ParseUUIDPipe` — it simply
// no-ops on a primitive route parameter, because there is no DTO metatype to validate. The
// decision therefore falls through to `ParseUUIDPipe`, which throws `BadRequestException`.
// Every route carrying `@Param('…', ParseUUIDPipe)` can return a 400 that no request body or
// query can explain.
//
// Deliberately NOT folded into `ApiAdminErrorResponses()`. That decorator is applied at the class
// level, where it would also declare 400 on list and create routes that have no UUID parameter and
// cannot produce this failure — a contract that is broader and LESS true. This one is applied per
// handler, next to the pipe that causes it, so the declaration and its cause stay adjacent.
//
// `noun` names the resource in the description; the parameter exists so a route can say "message
// id" rather than the generic form, and pre-existing wordings survive the migration unchanged.
// `uuid-param-contract.spec.ts` asserts the pipe and the declaration never diverge.
export function ApiUuidParamBadRequest(
  noun = 'resource',
): MethodDecorator & ClassDecorator {
  return ApiProblemResponse(
    HttpStatus.BAD_REQUEST,
    `The ${noun} id in the path is not a well-formed UUID.`,
  );
}

// The error set every locale-resolved public read can return: an unknown/disabled locale (400)
// and a malformed query (422).
export function ApiPublicReadErrorResponses(): MethodDecorator &
  ClassDecorator {
  return applyDecorators(
    ApiProblemResponse(HttpStatus.BAD_REQUEST, 'Unknown or disabled locale.'),
    ApiProblemResponse(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'Malformed query parameters.',
    ),
  );
}
