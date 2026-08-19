import { Module } from '@nestjs/common';
import { LocalesModule } from '../locales/locales.module';
import { MediaModule } from '../media/media.module';
import { RedirectsModule } from '../redirects/redirects.module';
import { ArticlesAdminController } from './articles.admin.controller';
import { ArticlesController } from './articles.controller';
import { ArticlesScheduler } from './articles.scheduler';
import { ArticlesService } from './articles.service';

// LocalesModule provides locale validation via its exported service (doc 07 §1). MediaModule
// exports MediaDescriptorResolver for public reads. RedirectsModule exports RedirectService so
// update() can push buildRedirectOps into its rename transaction (D04-6); no cycle — redirects
// imports neither articles nor projects. The scheduler is a provider so ScheduleModule (registered
// in AppModule) discovers its @Cron handler. ArticlesService is exported so PreviewModule can inject
// it for the mint existence check + getPreviewById (constitution rule 2 — cross-module use is
// via exported services only).
@Module({
  imports: [LocalesModule, MediaModule, RedirectsModule],
  controllers: [ArticlesController, ArticlesAdminController],
  providers: [ArticlesService, ArticlesScheduler],
  exports: [ArticlesService],
})
export class ArticlesModule {}
