import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, catchError, throwError } from 'rxjs';
import { ProcessingCapacityExceededException } from './processing-capacity.exception';

// The processing cap is enforced in the service (so a dedup hit consumes no slot), so its 429
// surfaces as a thrown exception rather than a guard. This route-scoped interceptor turns that
// exception into a `Retry-After` response header at the transport boundary, then rethrows so the
// global RFC-7807 filter renders the body — keeping header/transport concerns out of the service.
@Injectable()
export class RetryAfterInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        if (error instanceof ProcessingCapacityExceededException) {
          const response = context.switchToHttp().getResponse<Response>();
          response.setHeader('Retry-After', String(error.retryAfterSeconds));
        }
        return throwError(() => error);
      }),
    );
  }
}
