import { Module } from '@nestjs/common';
import { LocalesModule } from '../locales/locales.module';
import { MediaModule } from '../media/media.module';
import { ProjectsAdminController } from './projects.admin.controller';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

// ProjectsService is exported so PreviewModule can inject it for the mint existence check +
// getPreviewById (T6, constitution rule 2 — cross-module use is via exported services only).
@Module({
  imports: [LocalesModule, MediaModule],
  controllers: [ProjectsController, ProjectsAdminController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
