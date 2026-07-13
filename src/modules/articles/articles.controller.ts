import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { PaginatedResult } from '../../common/pagination/page-meta';
import {
  ApiOkEnvelope,
  ApiOkPaginated,
} from '../../common/swagger/api-envelope';
import {
  ApiProblemResponse,
  ApiPublicReadErrorResponses,
} from '../../common/swagger/api-problem-response';
import { ArticlesService } from './articles.service';
import { ArticleListQueryDto } from './dto/article-query.dto';
import {
  PublicArticleDetailEntity,
  PublicArticleListItemEntity,
} from './entities/article.entities';

@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List published articles, resolved and filtered by locale.',
  })
  @ApiOkPaginated(PublicArticleListItemEntity, {
    description: 'Paginated published articles.',
  })
  @ApiPublicReadErrorResponses()
  list(
    @Query() query: ArticleListQueryDto,
  ): Promise<PaginatedResult<PublicArticleListItemEntity>> {
    return this.articles.listPublic(query);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: 'Get a published article by its per-locale slug (drafts 404).',
  })
  @ApiParam({ name: 'slug', example: 'designing-a-modular-monolith' })
  @ApiOkEnvelope(PublicArticleDetailEntity)
  @ApiPublicReadErrorResponses()
  @ApiProblemResponse(
    HttpStatus.NOT_FOUND,
    'No published article with this slug in the locale.',
  )
  getBySlug(
    @Param('slug') slug: string,
    @Query() query: LocaleQueryDto,
  ): Promise<PublicArticleDetailEntity> {
    return this.articles.getPublicBySlug(slug, query.locale);
  }
}
