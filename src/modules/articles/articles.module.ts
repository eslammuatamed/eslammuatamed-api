import { Module } from '@nestjs/common';
import { LocalesModule } from '../locales/locales.module';
import { ArticlesAdminController } from './articles.admin.controller';
import { ArticlesController } from './articles.controller';
import { ArticlesScheduler } from './articles.scheduler';
import { ArticlesService } from './articles.service';

// LocalesModule provides locale validation via its exported service (doc 07 §1). The scheduler
// is a provider so ScheduleModule (registered in AppModule) discovers its @Cron handler.
@Module({
  imports: [LocalesModule],
  controllers: [ArticlesController, ArticlesAdminController],
  providers: [ArticlesService, ArticlesScheduler],
})
export class ArticlesModule {}
