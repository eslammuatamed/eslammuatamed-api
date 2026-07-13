import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginatedResult } from '../pagination/page-meta';

export interface Envelope<T> {
  readonly data: T;
}

export interface PaginatedEnvelope<T> {
  readonly data: readonly T[];
  readonly meta: PaginatedResult<T>['meta'];
}

// Wraps every 2xx body in the uniform envelope (D10-3): lists (PaginatedResult) become
// `{ data, meta }`, everything else `{ data }`. One shape, no exceptions — client parsing
// stays uniform (doc 06 §2). Errors bypass this path entirely (the exception filter owns them).
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<Envelope<unknown> | PaginatedEnvelope<unknown>> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (value instanceof PaginatedResult) {
          return { data: value.data, meta: value.meta };
        }
        return { data: value ?? null };
      }),
    );
  }
}
