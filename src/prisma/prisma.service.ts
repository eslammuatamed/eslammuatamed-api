import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';

// Connection is LAZY on purpose (constitution rule 4, plan 001): no $connect in
// onModuleInit. Prisma opens the pool on first query, so `contract:export` can boot the
// full Nest graph with the database down. The health module issues an explicit query to
// prove readiness. The datasource URL comes from AppConfigService, not raw process.env.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: AppConfigService) {
    super({ datasourceUrl: config.database.url });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
