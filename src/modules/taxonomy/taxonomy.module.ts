import { Module } from '@nestjs/common';
import { LocalesModule } from '../locales/locales.module';
import { CategoriesAdminController } from './categories.admin.controller';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { TagsAdminController } from './tags.admin.controller';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

// Categories and tags live in one module — they change together (doc 07 module map). Services
// are exported so other modules can reuse them via DI (doc 07 §1) rather than the models.
@Module({
  imports: [LocalesModule],
  controllers: [
    CategoriesController,
    CategoriesAdminController,
    TagsController,
    TagsAdminController,
  ],
  providers: [CategoriesService, TagsService],
  exports: [CategoriesService, TagsService],
})
export class TaxonomyModule {}
