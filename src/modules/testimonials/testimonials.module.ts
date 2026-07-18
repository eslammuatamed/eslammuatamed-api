import { Module } from '@nestjs/common';
import { LocalesModule } from '../locales/locales.module';
import { MediaModule } from '../media/media.module';
import { TestimonialsAdminController } from './testimonials.admin.controller';
import { TestimonialsController } from './testimonials.controller';
import { TestimonialsService } from './testimonials.service';

@Module({
  imports: [LocalesModule, MediaModule],
  controllers: [TestimonialsController, TestimonialsAdminController],
  providers: [TestimonialsService],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}
