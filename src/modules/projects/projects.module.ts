import { Module } from '@nestjs/common';
import { LocalesModule } from '../locales/locales.module';
import { ProjectsAdminController } from './projects.admin.controller';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [LocalesModule],
  controllers: [ProjectsController, ProjectsAdminController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
