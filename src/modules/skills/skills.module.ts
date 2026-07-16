import { Module } from '@nestjs/common';
import { LocalesModule } from '../locales/locales.module';
import { SkillsAdminController } from './skills.admin.controller';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

@Module({
  imports: [LocalesModule],
  controllers: [SkillsController, SkillsAdminController],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}
