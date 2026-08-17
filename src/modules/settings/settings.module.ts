import { Module } from '@nestjs/common';
import { LocalesModule } from '../locales/locales.module';
import { MediaModule } from '../media/media.module';
import { SettingsAdminController } from './settings.admin.controller';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

// LocalesModule is imported for its exported LocalesService (locale validation) — cross-module
// access via exported services only (doc 07 §1). MediaModule exports the descriptor resolver for
// the public résumé descriptor via `MediaDescriptorResolver`. PrismaService comes from the global module.
@Module({
  imports: [LocalesModule, MediaModule],
  controllers: [SettingsController, SettingsAdminController],
  providers: [SettingsService],
})
export class SettingsModule {}
