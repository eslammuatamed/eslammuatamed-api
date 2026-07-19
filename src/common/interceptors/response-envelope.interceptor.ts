import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DataWithMeta } from '../http/data-with-meta';
import { PaginatedResult } from '../pagination/page-meta';

export interface Envelope<T> {
  readonly data: T;
}

export interface PaginatedEnvelope<T> {
  readonly data: readonly T[];
  readonly meta: PaginatedResult<T>['meta'];
}

export interface MetaEnvelope<T, M> {
  readonly data: T;
  readonly meta: M;
}

// Wraps every 2xx body in the uniform envelope (D10-3): lists (PaginatedResult) become
// `{ data, meta }`, a single value that must carry meta (DataWithMeta — e.g. the dedup upload's
// `meta.deduplicated`) becomes `{ data, meta }`, everything else `{ data }`. One shape, no
// exceptions — client parsing stays uniform (doc 06 §2). Errors bypass this path entirely (the
// exception filter owns them).
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<
    | Envelope<unknown>
    | PaginatedEnvelope<unknown>
    | MetaEnvelope<unknown, unknown>
  > {
    return next.handle().pipe(
      map((value: unknown) => {
        if (value instanceof PaginatedResult) {
          return { data: value.data, meta: value.meta };
        }
        if (value instanceof DataWithMeta) {
          const withMeta = value as DataWithMeta<unknown, unknown>;
          return { data: withMeta.data, meta: withMeta.meta };
        }
        return { data: value ?? null };
      }),
    );
  }
}
