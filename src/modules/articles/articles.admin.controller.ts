import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PaginatedResult } from '../../common/pagination/page-meta';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiOkPaginated,
} from '../../common/swagger/api-envelope';
import {
  ApiAdminErrorResponses,
  ApiProblemResponse,
} from '../../common/swagger/api-problem-response';
import { THROTTLE_TIERS } from '../../common/throttling/throttle-tiers';
import { RequirePermission } from '../access-control/decorators/require-permission.decorator';
import { ArticlesService } from './articles.service';
import { AdminArticleListQueryDto } from './dto/article-query.dto';
import { CreateArticleDto, UpdateArticleDto } from './dto/article.dto';
import { AdminArticleEntity } from './entities/article.entities';

// Each method declares its articles.* permission (doc 19 §3, D19-8). Status transitions
// (including publish) currently ride on articles.update; articles.publish is reserved in the
// catalog for a dedicated publish action.
@ApiTags('articles')
@ApiBearerAuth('access-token')
@Throttle({ default: THROTTLE_TIERS.admin })
@ApiAdminErrorResponses()
@Controller('admin/articles')
export class ArticlesAdminController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  @RequirePermission('articles.read')
  @ApiOperation({
    summary: 'List articles (any status) with full translation maps.',
  })
  @ApiOkPaginated(AdminArticleEntity)
  list(
    @Query() query: AdminArticleListQueryDto,
  ): Promise<PaginatedResult<AdminArticleEntity>> {
    return this.articles.listAdmin(query);
  }

  @Get(':id')
  @RequirePermission('articles.read')
  @ApiOperation({ summary: 'Get one article with its full translation map.' })
  @ApiOkEnvelope(AdminArticleEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Article not found.')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminArticleEntity> {
    return this.articles.getAdmin(id);
  }

  @Post()
  @RequirePermission('articles.create')
  @ApiOperation({
    summary: 'Create an article with translations, tags, and scheduling.',
  })
  @ApiCreatedEnvelope(AdminArticleEntity)
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Validation error, slug collision, or invalid publishAt.',
  )
  create(@Body() dto: CreateArticleDto): Promise<AdminArticleEntity> {
    return this.articles.create(dto);
  }

  @Patch(':id')
  @RequirePermission('articles.update')
  @ApiOperation({
    summary: 'Update an article; upserts translations and status transitions.',
  })
  @ApiOkEnvelope(AdminArticleEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Article not found.')
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Validation error, slug collision, or invalid publishAt.',
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateArticleDto,
  ): Promise<AdminArticleEntity> {
    return this.articles.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('articles.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an article.' })
  @ApiNoContentResponse({ description: 'Article deleted.' })
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Article not found.')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.articles.remove(id);
  }
}
