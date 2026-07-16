import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import { ApiPublicReadErrorResponses } from '../../common/swagger/api-problem-response';
import { CategoriesService } from './categories.service';
import { PublicCategoryEntity } from './entities/category.entities';

@ApiTags('taxonomy')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List categories resolved to the requested locale.',
  })
  @ApiOkEnvelope(PublicCategoryEntity, {
    description: 'Categories in the requested locale.',
    isArray: true,
  })
  @ApiPublicReadErrorResponses()
  list(@Query() query: LocaleQueryDto): Promise<PublicCategoryEntity[]> {
    return this.categories.listPublic(query.locale);
  }
}
