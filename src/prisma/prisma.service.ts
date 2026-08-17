import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppConfigService } from '../config/app-config.service';
import { PrismaClient } from '../generated/prisma/client';

// Connection is LAZY on purpose (constitution rule 4, plan 001): no $connect in
// onModuleInit. The pg pool opens on first query, so `contract:export` can boot the
// full Nest graph with the database down. The health module issues an explicit query to
// prove readiness. The datasource URL comes from AppConfigService, not raw process.env.
//
// Prisma 7 no longer talks to PostgreSQL itself: `PrismaPg` owns a `pg` connection pool
// and Prisma sends queries through it. That is why the pool settings live here, and why each
// option below records what the v6 engine did and whether we kept it — two are held at the v6
// values on purpose, and `max` deliberately is not.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: AppConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.database.url,
        // `pg`'s own defaults differ from the Prisma 6 engine's. Two are kept at
        // the v6 values on purpose; the third is left at the driver default.
        //
        // connectionTimeoutMillis: pg defaults to 0, meaning "wait forever". With
        // the database down, requests would hang instead of failing, and the health
        // endpoint would stop reporting unreadiness. v6 failed after 5s — keep that.
        connectionTimeoutMillis: 5_000,
        // idleTimeoutMillis: pg defaults to 10s, which would churn connections on a
        // low-traffic API. v6 held idle connections for 300s — keep that too.
        idleTimeoutMillis: 300_000,
        // max: left at pg's default of 10. v6 computed cores*2+1; for a
        // single-instance portfolio API the difference is immaterial, and the
        // supported default is the simpler thing to explain and maintain.
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
