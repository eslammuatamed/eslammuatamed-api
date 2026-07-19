import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import {
  FieldError,
  PROBLEM_CONTENT_TYPE,
  PROBLEM_TYPES,
  ProblemDetails,
} from '../http/problem-details';
import { ValidationProblemException } from '../http/validation-problem.exception';

// The single exception → RFC 7807 translation point (doc 07 §3). Every non-2xx response
// leaves the process as application/problem+json. Prisma known-error codes are mapped to
// meaningful HTTP statuses; unexpected errors are sanitized to a 500 (no internals in
// production — doc 19) while the real cause is logged.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly config: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const problem = this.toProblem(exception, request.url);

    // 5xx responses are logged with their cause (doc 19); 4xx are client errors and stay quiet.
    // Compared as a plain number: `problem.status` is a number, so an HttpStatus enum operand
    // would be a mixed-type comparison (no-unsafe-enum-comparison).
    if (problem.status >= 500) {
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(problem.status).type(PROBLEM_CONTENT_TYPE).json(problem);
  }

  private toProblem(exception: unknown, instance: string): ProblemDetails {
    if (exception instanceof ValidationProblemException) {
      return {
        type: PROBLEM_TYPES.validation,
        title: 'Validation failed',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: `${exception.fieldErrors.length} field(s) failed validation.`,
        instance,
        errors: exception.fieldErrors,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrisma(exception, instance);
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception, instance);
    }

    return {
      type: PROBLEM_TYPES.internal,
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: this.config.isProduction
        ? 'An unexpected error occurred.'
        : exception instanceof Error
          ? exception.message
          : 'An unexpected error occurred.',
      instance,
    };
  }

  private fromPrisma(
    exception: Prisma.PrismaClientKnownRequestError,
    instance: string,
  ): ProblemDetails {
    switch (exception.code) {
      // Unique constraint — a slug/email collision. 422 with the offending field paths.
      case 'P2002': {
        const errors = uniqueTargetToFieldErrors(exception.meta?.target);
        return {
          type: PROBLEM_TYPES.validation,
          title: 'Validation failed',
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          detail: 'A record with these values already exists.',
          instance,
          errors,
        };
      }
      // Record not found (update/delete of an absent row).
      case 'P2025':
        return {
          type: PROBLEM_TYPES.notFound,
          title: 'Not Found',
          status: HttpStatus.NOT_FOUND,
          detail: 'The requested resource does not exist.',
          instance,
        };
      // Foreign-key violation — deleting a still-referenced row (e.g. a used category/asset).
      case 'P2003':
        return {
          type: PROBLEM_TYPES.conflict,
          title: 'Conflict',
          status: HttpStatus.CONFLICT,
          detail:
            'The resource is referenced by other records and cannot be modified.',
          instance,
        };
      default:
        return {
          type: PROBLEM_TYPES.badRequest,
          title: 'Bad Request',
          status: HttpStatus.BAD_REQUEST,
          detail: 'The request could not be processed.',
          instance,
        };
    }
  }

  private fromHttpException(
    exception: HttpException,
    instance: string,
  ): ProblemDetails {
    const status = exception.getStatus();
    const { type, title } = problemMetaForStatus(status);
    const problem: ProblemDetails = {
      type,
      title,
      status,
      detail: extractDetail(exception),
      instance,
    };
    // A 409 media-in-use response carries its blocking references as an RFC 7807 extension
    // member (doc 10 §6); duck-typed so this shared filter needs no dependency on the media module.
    const usages = extractUsages(exception);
    return usages ? { ...problem, usages } : problem;
  }
}

// An HttpException whose response object supplies a `usages` array surfaces it as a problem+json
// extension member (the media 409 delete-in-use path). Any other exception is unaffected.
function extractUsages(
  exception: HttpException,
): readonly unknown[] | undefined {
  const response = exception.getResponse();
  if (typeof response === 'object' && response !== null) {
    const usages = (response as { usages?: unknown }).usages;
    if (Array.isArray(usages)) {
      return usages as readonly unknown[];
    }
  }
  return undefined;
}

// Typed HttpStatus so the case labels compare enum-to-enum (no-unsafe-enum-comparison); the
// caller narrows the numeric getStatus() result.
function problemMetaForStatus(status: HttpStatus): {
  type: string;
  title: string;
} {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return { type: PROBLEM_TYPES.badRequest, title: 'Bad Request' };
    case HttpStatus.UNAUTHORIZED:
      return { type: PROBLEM_TYPES.unauthorized, title: 'Unauthorized' };
    case HttpStatus.FORBIDDEN:
      return { type: PROBLEM_TYPES.forbidden, title: 'Forbidden' };
    case HttpStatus.NOT_FOUND:
      return { type: PROBLEM_TYPES.notFound, title: 'Not Found' };
    case HttpStatus.CONFLICT:
      return { type: PROBLEM_TYPES.conflict, title: 'Conflict' };
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return { type: PROBLEM_TYPES.validation, title: 'Unprocessable Entity' };
    case HttpStatus.TOO_MANY_REQUESTS:
      return {
        type: PROBLEM_TYPES.tooManyRequests,
        title: 'Too Many Requests',
      };
    case HttpStatus.SERVICE_UNAVAILABLE:
      return {
        type: PROBLEM_TYPES.serviceUnavailable,
        title: 'Service Unavailable',
      };
    default:
      return { type: PROBLEM_TYPES.internal, title: 'Internal Server Error' };
  }
}

function extractDetail(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  if (typeof response === 'object' && response !== null) {
    const message = (response as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.join('; ');
    }
  }
  return exception.message;
}

// Prisma reports the P2002 target as a column list, a constraint name, or (rarely) null.
function uniqueTargetToFieldErrors(target: unknown): FieldError[] {
  const message = 'This value is already in use.';
  if (Array.isArray(target)) {
    return target
      .filter((field): field is string => typeof field === 'string')
      .map((field) => ({ field, message }));
  }
  if (typeof target === 'string') {
    return [{ field: target, message }];
  }
  return [{ field: 'unknown', message }];
}
