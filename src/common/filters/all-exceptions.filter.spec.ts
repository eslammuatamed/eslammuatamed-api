import {
  ArgumentsHost,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppConfigService } from '../../config/app-config.service';
import { ProblemDetails } from '../http/problem-details';
import { ValidationProblemException } from '../http/validation-problem.exception';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface CapturedResponse {
  status: number;
  contentType: string;
  body: ProblemDetails;
}

interface MockResponse {
  status: jest.Mock<MockResponse, [number]>;
  type: jest.Mock<MockResponse, [string]>;
  json: jest.Mock<MockResponse, [ProblemDetails]>;
}

function createHost(
  captured: CapturedResponse,
  url = '/api/v1/admin/articles',
): ArgumentsHost {
  // Annotated so the chainable self-reference (each method returns `response`) doesn't infer
  // as implicit `any` (strict TS, constitution rule 7).
  const response: MockResponse = {
    status: jest.fn((code: number) => {
      captured.status = code;
      return response;
    }),
    type: jest.fn((value: string) => {
      captured.contentType = value;
      return response;
    }),
    json: jest.fn((body: ProblemDetails) => {
      captured.body = body;
      return response;
    }),
  };
  const request = { url, method: 'POST' };
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  const config = { isProduction: false } as AppConfigService;
  const filter = new AllExceptionsFilter(config);

  const capture = (exception: unknown, url?: string): CapturedResponse => {
    const captured = {} as CapturedResponse;
    filter.catch(exception, createHost(captured, url));
    return captured;
  };

  it('emits problem+json content type and the request URL as instance', () => {
    const result = capture(new NotFoundException(), '/api/v1/articles/x');
    expect(result.contentType).toBe('application/problem+json');
    expect(result.body.instance).toBe('/api/v1/articles/x');
  });

  it('maps a ValidationProblemException to 422 with errors[]', () => {
    const exception = new ValidationProblemException([
      { field: 'translations[0].slug', message: 'slug should not be empty' },
    ]);
    const result = capture(exception);

    expect(result.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(result.body.type).toBe('/problems/validation');
    expect(result.body.errors).toEqual([
      { field: 'translations[0].slug', message: 'slug should not be empty' },
    ]);
  });

  it('maps Prisma P2002 (unique) to 422 with the conflicting field paths', () => {
    const exception = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '6.0.0',
        meta: { target: ['locale', 'slug'] },
      },
    );
    const result = capture(exception);

    expect(result.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(result.body.errors?.map((e) => e.field)).toEqual(['locale', 'slug']);
  });

  it('maps Prisma P2025 (not found) to 404', () => {
    const exception = new Prisma.PrismaClientKnownRequestError(
      'Record not found',
      {
        code: 'P2025',
        clientVersion: '6.0.0',
      },
    );
    const result = capture(exception);

    expect(result.status).toBe(HttpStatus.NOT_FOUND);
    expect(result.body.type).toBe('/problems/not-found');
  });

  it('maps a Nest ForbiddenException to 403', () => {
    const result = capture(new ForbiddenException('Insufficient role'));
    expect(result.status).toBe(HttpStatus.FORBIDDEN);
    expect(result.body.type).toBe('/problems/forbidden');
  });

  it('sanitizes an unknown error to 500 without leaking internals in production', () => {
    const prodFilter = new AllExceptionsFilter({
      isProduction: true,
    } as AppConfigService);
    const captured = {} as CapturedResponse;
    prodFilter.catch(
      new Error('secret db connection string'),
      createHost(captured),
    );

    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.body.detail).toBe('An unexpected error occurred.');
    expect(captured.body.detail).not.toContain('secret');
  });
});
