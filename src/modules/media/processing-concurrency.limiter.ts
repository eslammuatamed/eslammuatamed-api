import { Injectable } from '@nestjs/common';
import { MAX_CONCURRENT_PROCESSING } from './media.constants';
import { ProcessingCapacityExceededException } from './processing-capacity.exception';

// Bounds concurrent Sharp/PDF processing to MAX_CONCURRENT_PROCESSING per API instance (Q3, doc 19
// §6). Sharp is memory-heavy, so a per-minute rate cap alone can't stop a burst exhausting memory.
// Node is single-threaded, so the counter check-and-increment below is atomic (no `await` sits
// between them); the slot is released in `finally`, so it frees on every success and failure path.
// Deliberately a plain injectable with no queue — a job that finds both slots busy fails fast.
@Injectable()
export class ProcessingConcurrencyLimiter {
  private active = 0;

  get inFlight(): number {
    return this.active;
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= MAX_CONCURRENT_PROCESSING) {
      throw new ProcessingCapacityExceededException();
    }
    this.active++;
    try {
      return await work();
    } finally {
      this.active--;
    }
  }
}
