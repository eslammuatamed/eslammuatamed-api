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
import { AdminProjectListQueryDto } from './dto/project-query.dto';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { AdminProjectEntity } from './entities/project.entities';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth('access-token')
@Throttle({ default: THROTTLE_TIERS.admin })
@ApiAdminErrorResponses()
@Controller('admin/projects')
export class ProjectsAdminController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @RequirePermission('projects.read')
  @ApiOperation({
    summary: 'List all projects, including unpublished entries.',
  })
  @ApiOkPaginated(AdminProjectEntity)
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Malformed query parameters (D10-18): unknown sortBy/sortOrder, a non-boolean isPublished/featured, q over 120 chars, perPage over 50, or an unwhitelisted field.',
  )
  list(
    @Query() query: AdminProjectListQueryDto,
  ): Promise<PaginatedResult<AdminProjectEntity>> {
    return this.projects.listAdmin(query);
  }

  @Get(':id')
  @RequirePermission('projects.read')
  @ApiOperation({ summary: 'Get one project with its full translation map.' })
  @ApiOkEnvelope(AdminProjectEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Project not found.')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminProjectEntity> {
    return this.projects.getAdmin(id);
  }

  @Post()
  @RequirePermission('projects.create')
  @ApiOperation({ summary: 'Create a project, gallery, and technology links.' })
  @ApiCreatedEnvelope(AdminProjectEntity)
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Validation error, invalid locale, or slug collision.',
  )
  create(@Body() dto: CreateProjectDto): Promise<AdminProjectEntity> {
    return this.projects.create(dto);
  }

  @Patch(':id')
  @RequirePermission('projects.update')
  @ApiOperation({
    summary: 'Update a project and replace provided relation sets.',
  })
  @ApiOkEnvelope(AdminProjectEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Project not found.')
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Validation error, invalid locale, or slug collision.',
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<AdminProjectEntity> {
    return this.projects.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('projects.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Project deleted.' })
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Project not found.')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.projects.remove(id);
  }
}
