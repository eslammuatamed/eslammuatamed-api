import { Module } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { ProjectsModule } from '../projects/projects.module';
import { PreviewAdminController } from './preview.admin.controller';
import { PreviewController } from './preview.controller';
import { PreviewTokenService } from './preview-token.service';

// AppConfigModule is @Global, so PreviewTokenService injects AppConfigService for the HMAC secret
// without importing it here (matches every sibling module). ArticlesModule/ProjectsModule export
// their services (T6 prereq) so the mint controller can assert existence and the consume controller
// can call getPreviewById — no cycle: preview → articles/projects, never back.
@Module({
  imports: [ArticlesModule, ProjectsModule],
  controllers: [PreviewAdminController, PreviewController],
  providers: [PreviewTokenService],
})
export class PreviewModule {}
