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
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiOkPaginated,
} from '../../common/swagger/api-envelope';
import { PaginatedResult } from '../../common/pagination/page-meta';
import {
  ApiAdminErrorResponses,
  ApiProblemResponse,
  ApiUuidParamBadRequest,
} from '../../common/swagger/api-problem-response';
import { THROTTLE_TIERS } from '../../common/throttling/throttle-tiers';
import { RequirePermission } from '../access-control/decorators/require-permission.decorator';
import {
  AdminExperienceListQueryDto,
  CreateExperienceDto,
  UpdateExperienceDto,
} from './dto/experience.dto';
import { AdminExperienceEntity } from './entities/experience.entities';
import { ExperiencesService } from './experiences.service';

@ApiTags('experiences')
@ApiBearerAuth('access-token')
@Throttle({ default: THROTTLE_TIERS.admin })
@ApiAdminErrorResponses()
@Controller('admin/experiences')
export class ExperiencesAdminController {
  constructor(private readonly experiences: ExperiencesService) {}
  @Get()
  @RequirePermission('experiences.read')
  @ApiOkPaginated(AdminExperienceEntity)
  @ApiOperation({ summary: 'List experiences with full translations.' })
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Malformed pagination query parameters: page must be at least 1, perPage must be 1 through 50, and unknown fields are rejected.',
  )
  list(
    @Query() query: AdminExperienceListQueryDto,
  ): Promise<PaginatedResult<AdminExperienceEntity>> {
    return this.experiences.listAdmin(query);
  }
  @Get(':id')
  @RequirePermission('experiences.read')
  @ApiOkEnvelope(AdminExperienceEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Experience not found.')
  @ApiUuidParamBadRequest('experience')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminExperienceEntity> {
    return this.experiences.getAdmin(id);
  }
  @Post()
  @RequirePermission('experiences.create')
  @ApiCreatedEnvelope(AdminExperienceEntity)
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Validation error or invalid employment type.',
  )
  create(@Body() dto: CreateExperienceDto): Promise<AdminExperienceEntity> {
    return this.experiences.create(dto);
  }
  @Patch(':id')
  @RequirePermission('experiences.update')
  @ApiOkEnvelope(AdminExperienceEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Experience not found.')
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Validation error or invalid employment type.',
  )
  @ApiUuidParamBadRequest('experience')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExperienceDto,
  ): Promise<AdminExperienceEntity> {
    return this.experiences.update(id, dto);
  }
  @Delete(':id')
  @RequirePermission('experiences.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Experience deleted.' })
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Experience not found.')
  @ApiUuidParamBadRequest('experience')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.experiences.remove(id);
  }
}
