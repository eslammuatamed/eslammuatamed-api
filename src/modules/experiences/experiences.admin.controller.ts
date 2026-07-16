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
} from '../../common/swagger/api-envelope';
import {
  ApiAdminErrorResponses,
  ApiProblemResponse,
} from '../../common/swagger/api-problem-response';
import { THROTTLE_TIERS } from '../../common/throttling/throttle-tiers';
import { RequirePermission } from '../access-control/decorators/require-permission.decorator';
import { CreateExperienceDto, UpdateExperienceDto } from './dto/experience.dto';
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
  @ApiOkEnvelope(AdminExperienceEntity, { isArray: true })
  @ApiOperation({ summary: 'List experiences with full translations.' })
  list(): Promise<AdminExperienceEntity[]> {
    return this.experiences.listAdmin();
  }
  @Get(':id')
  @RequirePermission('experiences.read')
  @ApiOkEnvelope(AdminExperienceEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Experience not found.')
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
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.experiences.remove(id);
  }
}
