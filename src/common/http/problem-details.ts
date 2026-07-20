import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// RFC 7807 problem+json (D10-5). `type` is a relative URI reference — the platform's
// public host is deferred (D23-8) and the constitution keeps hosts out of code, so we do
// not hardcode an absolute problems base. Relative references are valid per RFC 7807 §3.1.
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export const PROBLEM_TYPES = {
  badRequest: '/problems/bad-request',
  unauthorized: '/problems/unauthorized',
  forbidden: '/problems/forbidden',
  notFound: '/problems/not-found',
  conflict: '/problems/conflict',
  validation: '/problems/validation',
  payloadTooLarge: '/problems/payload-too-large',
  tooManyRequests: '/problems/too-many-requests',
  serviceUnavailable: '/problems/service-unavailable',
  internal: '/problems/internal',
} as const;

export interface FieldError {
  readonly field: string;
  readonly message: string;
}

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance: string;
  readonly errors?: readonly FieldError[];
  // RFC 7807 extension member (§3.2): the references blocking a 409 delete (doc 10 §6). Carried
  // through from an HttpException response object that supplies a `usages` array.
  readonly usages?: readonly unknown[];
}

// Swagger schema for the error envelope so the contract documents error shapes too.
export class FieldErrorDto {
  @ApiProperty({
    example: 'translations[0].slug',
    description: 'Dotted path to the offending field.',
  })
  readonly field!: string;

  @ApiProperty({ example: "Slug already exists for locale 'en'." })
  readonly message!: string;
}

export class ProblemDetailsDto {
  @ApiProperty({
    example: '/problems/validation',
    description: 'A URI reference identifying the problem type.',
  })
  readonly type!: string;

  @ApiProperty({ example: 'Validation failed' })
  readonly title!: string;

  @ApiProperty({ example: 422 })
  readonly status!: number;

  @ApiProperty({ example: '2 fields failed validation.' })
  readonly detail!: string;

  @ApiProperty({ example: '/api/v1/admin/articles' })
  readonly instance!: string;

  @ApiPropertyOptional({
    type: [FieldErrorDto],
    description: 'Present on 422 responses only.',
  })
  readonly errors?: readonly FieldError[];

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object' },
    description:
      'Present on a 409 media-in-use response only: the records referencing the asset.',
  })
  readonly usages?: readonly unknown[];
}
