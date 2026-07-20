import { Module } from '@nestjs/common';
import { LocalesModule } from '../locales/locales.module';
import { MediaModule } from '../media/media.module';
import { ArticlesAdminController } from './articles.admin.controller';
import { ArticlesController } from './articles.controller';
import { ArticlesScheduler } from './articles.scheduler';
import { ArticlesService } from './articles.service';

// LocalesModule provides locale validation via its exported service (doc 07 §1). MediaModule
// exports the descriptor resolver for public reads (T7). The scheduler is a provider so
// ScheduleModule (registered in AppModule) discovers its @Cron handler. ArticlesService is exported
// so PreviewModule can inject it for the mint existence check + getPreviewById (T6, constitution
// rule 2 — cross-module use is via exported services only).
@Module({
  imports: [LocalesModule, MediaModule],
  controllers: [ArticlesController, ArticlesAdminController],
  providers: [ArticlesService, ArticlesScheduler],
  exports: [ArticlesService],
})
export class ArticlesModule {}
