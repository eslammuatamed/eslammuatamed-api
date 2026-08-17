import { Module } from '@nestjs/common';
import { LocalesModule } from '../locales/locales.module';
import { MediaModule } from '../media/media.module';
import { SeoAdminController } from './seo.admin.controller';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';

// LocalesModule for locale validation and MediaModule for the OG descriptor resolver — cross-module
// access via exported services only (doc 07 §1). PrismaService comes from the global module.
@Module({
  imports: [LocalesModule, MediaModule],
  controllers: [SeoController, SeoAdminController],
  providers: [SeoService],
})
export class SeoModule {}
