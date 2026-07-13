import { Module } from '@nestjs/common';
import { LocalesModule } from '../locales/locales.module';
import { SettingsAdminController } from './settings.admin.controller';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

// LocalesModule is imported for its exported LocalesService (locale validation) — cross-module
// access via exported services only (doc 07 §1). PrismaService comes from the global module.
@Module({
  imports: [LocalesModule],
  controllers: [SettingsController, SettingsAdminController],
  providers: [SettingsService],
})
export class SettingsModule {}
