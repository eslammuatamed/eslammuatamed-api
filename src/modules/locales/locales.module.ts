import { Module } from '@nestjs/common';
import { LocalesController } from './locales.controller';
import { LocalesService } from './locales.service';

// Exports LocalesService so settings/articles can validate ?locale= without reaching into
// the Locale model themselves (cross-module access via exported services only — doc 07 §1).
@Module({
  controllers: [LocalesController],
  providers: [LocalesService],
  exports: [LocalesService],
})
export class LocalesModule {}
