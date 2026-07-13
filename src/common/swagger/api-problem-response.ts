import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import {
  PROBLEM_CONTENT_TYPE,
  ProblemDetailsDto,
} from '../http/problem-details';

// Documents an RFC 7807 error response (doc 10 §3) with the shared ProblemDetails schema under
// the `application/problem+json` media type — exactly what the global exception filter emits, so
// jest-openapi contract assertions cover error paths too. @ApiExtraModels forces ProblemDetailsDto
// (and its nested FieldErrorDto) into components.schemas even though no body/param references it.
export function ApiProblemResponse(
  status: number,
  description: string,
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(ProblemDetailsDto),
    ApiResponse({
      status,
      description,
      content: {
        [PROBLEM_CONTENT_TYPE]: {
          schema: { $ref: getSchemaPath(ProblemDetailsDto) },
        },
      },
    }),
  );
}

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
