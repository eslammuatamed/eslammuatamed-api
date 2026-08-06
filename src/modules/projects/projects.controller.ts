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
import { ProjectListQueryDto } from './dto/project-query.dto';
import {
  ProjectListMeta,
  PublicProjectDetailEntity,
  PublicProjectListItemEntity,
} from './entities/project.entities';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List published projects, resolved and filtered by locale.',
  })
  @ApiOkPaginated(PublicProjectListItemEntity, {
    description:
      'Featured-first paginated published projects, plus the technology facets the filter should offer (D10-19).',
    meta: ProjectListMeta,
  })
  @ApiPublicReadErrorResponses()
  list(
    @Query() query: ProjectListQueryDto,
  ): Promise<PaginatedResult<PublicProjectListItemEntity, ProjectListMeta>> {
    return this.projects.listPublic(query);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: 'Get a published project by its per-locale slug.',
  })
  @ApiParam({ name: 'slug', example: 'content-platform-api' })
  @ApiOkEnvelope(PublicProjectDetailEntity)
  @ApiPublicReadErrorResponses()
  @ApiProblemResponse(
    HttpStatus.NOT_FOUND,
    'No published project with this slug in the locale.',
  )
  getBySlug(
    @Param('slug') slug: string,
    @Query() query: LocaleQueryDto,
  ): Promise<PublicProjectDetailEntity> {
    return this.projects.getPublicBySlug(slug, query.locale);
  }
}
