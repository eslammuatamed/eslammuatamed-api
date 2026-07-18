import { Module } from '@nestjs/common';
import { LocalesModule } from '../locales/locales.module';
import { MediaModule } from '../media/media.module';
import { ProjectsAdminController } from './projects.admin.controller';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [LocalesModule, MediaModule],
  controllers: [ProjectsController, ProjectsAdminController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
