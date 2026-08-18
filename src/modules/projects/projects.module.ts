import { Module } from '@nestjs/common';
import { LocalesModule } from '../locales/locales.module';
import { MediaModule } from '../media/media.module';
import { RedirectsModule } from '../redirects/redirects.module';
import { ProjectsAdminController } from './projects.admin.controller';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

// RedirectsModule exports RedirectService so update() can push buildRedirectOps into its rename
// transaction (D04-6); no cycle — redirects imports neither articles nor projects.
// ProjectsService is exported so PreviewModule can inject it for the mint existence check +
// getPreviewById (constitution rule 2 — cross-module use is via exported services only).
@Module({
  imports: [LocalesModule, MediaModule, RedirectsModule],
  controllers: [ProjectsController, ProjectsAdminController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
