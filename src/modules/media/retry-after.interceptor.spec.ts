import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ProcessingCapacityExceededException } from './processing-capacity.exception';
import { RetryAfterInterceptor } from './retry-after.interceptor';

describe('RetryAfterInterceptor', () => {
  const interceptor = new RetryAfterInterceptor();

  const contextWith = (setHeader: jest.Mock): ExecutionContext =>
    ({
      switchToHttp: () => ({ getResponse: () => ({ setHeader }) }),
    }) as unknown as ExecutionContext;

  it('sets Retry-After when the processing cap rejects the upload', async () => {
    const setHeader = jest.fn();
    const next: CallHandler = {
      handle: () => throwError(() => new ProcessingCapacityExceededException()),
    };

    const error = await firstValueFrom(
      interceptor.intercept(contextWith(setHeader), next),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProcessingCapacityExceededException);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('passes other errors through without touching headers', async () => {
    const setHeader = jest.fn();
    const next: CallHandler = {
      handle: () => throwError(() => new Error('unrelated')),
    };

    const error = await firstValueFrom(
      interceptor.intercept(contextWith(setHeader), next),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('leaves a successful response untouched', async () => {
    const setHeader = jest.fn();
    const next: CallHandler = { handle: () => of({ data: 'ok' }) };

    const result = await firstValueFrom(
      interceptor.intercept(contextWith(setHeader), next),
    );

    expect(result).toEqual({ data: 'ok' });
    expect(setHeader).not.toHaveBeenCalled();
  });
});
