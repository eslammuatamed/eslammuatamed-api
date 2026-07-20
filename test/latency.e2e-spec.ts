import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp, httpServer } from './utils/e2e-app';

// NFR-006 latency smoke (doc 20 §5, D20-7): a COARSE p95 guard over the public read endpoints,
// not a load test (doc 18 §7). A warmup pass is discarded (absorbs lazy-Prisma cold connect and
// JIT), then a bounded number of samples is measured. The budget is env-overridable and deliberately
// generous — NOT the literal 200 ms production SLO, because shared CI hardware is noisier than
// production. This is a regression tripwire that fails only on a gross latency blow-up (e.g. an
// accidental N+1), never on ordinary CI jitter. Structural N+1 prevention is additionally a review
// gate (doc 20 §7). The sample volume stays under the public throttle tier (120 / min) within this
// suite's own app instance (fresh in-memory bucket).
const PUBLIC_READ_PATHS = [
  '/api/v1/health',
  '/api/v1/locales',
  '/api/v1/articles',
  '/api/v1/projects',
] as const;

const WARMUP_PER_PATH = 3;
const SAMPLES_PER_PATH = 12; // 4 paths * (3 + 12) = 60 measured + 12 warmup = 72 requests (< 120/min)
const P95_BUDGET_MS = Number(process.env.LATENCY_SMOKE_P95_MS ?? 500);

function p95(samplesMs: number[]): number {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const index = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

describe('NFR-006 latency smoke (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it(`keeps public-read p95 under a coarse budget (${P95_BUDGET_MS} ms) with every response 2xx`, async () => {
    const server = httpServer(app);

    // Warmup — discarded (cold connect / JIT).
    for (const path of PUBLIC_READ_PATHS) {
      for (let i = 0; i < WARMUP_PER_PATH; i++) {
        await request(server).get(path);
      }
    }

    // Measured samples.
    const durations: number[] = [];
    let non2xx = 0;
    for (const path of PUBLIC_READ_PATHS) {
      for (let i = 0; i < SAMPLES_PER_PATH; i++) {
        const startedAt = Date.now();
        const res = await request(server).get(path);
        durations.push(Date.now() - startedAt);
        if (res.status < 200 || res.status >= 300) {
          non2xx += 1;
        }
      }
    }

    // Every sampled public read succeeded (no throttling reached, no 5xx).
    expect(non2xx).toBe(0);

    const measuredP95 = p95(durations);
    // Surfaced on failure so a regression shows the actual number, not just a boolean.
    if (measuredP95 >= P95_BUDGET_MS) {
      throw new Error(
        `NFR-006 latency smoke: public-read p95 ${measuredP95} ms exceeded the ${P95_BUDGET_MS} ms budget ` +
          `over ${durations.length} samples. This is a coarse regression tripwire — investigate a ` +
          `gross slowdown (e.g. an N+1) before raising LATENCY_SMOKE_P95_MS.`,
      );
    }
    expect(measuredP95).toBeLessThan(P95_BUDGET_MS);
  });
});
