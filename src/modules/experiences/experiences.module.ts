import { Module } from '@nestjs/common';
import { LocalesModule } from '../locales/locales.module';
import { ExperiencesAdminController } from './experiences.admin.controller';
import { ExperiencesController } from './experiences.controller';
import { ExperiencesService } from './experiences.service';

@Module({
  imports: [LocalesModule],
  controllers: [ExperiencesController, ExperiencesAdminController],
  providers: [ExperiencesService],
  exports: [ExperiencesService],
})
export class ExperiencesModule {}
