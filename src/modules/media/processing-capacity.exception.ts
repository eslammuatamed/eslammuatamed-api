import { HttpException, HttpStatus } from '@nestjs/common';
import { PROCESSING_RETRY_AFTER_SECONDS } from './media.constants';

// 429 raised when the in-process processing cap (2/instance, Q3, doc 19 §6) is full. It carries the
// Retry-After value so RetryAfterInterceptor can write the header; the body is rendered by the
// global RFC-7807 filter like any other HttpException. No queue — fail fast.
export class ProcessingCapacityExceededException extends HttpException {
  readonly retryAfterSeconds = PROCESSING_RETRY_AFTER_SECONDS;

  constructor() {
    super(
      'The server is processing the maximum number of uploads. Please retry shortly.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
