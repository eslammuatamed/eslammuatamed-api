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
  ApiUuidParamBadRequest,
} from '../../common/swagger/api-problem-response';
import { THROTTLE_TIERS } from '../../common/throttling/throttle-tiers';
import { RequirePermission } from '../access-control/decorators/require-permission.decorator';
import { CreateSkillDto, UpdateSkillDto } from './dto/skill.dto';
import { AdminSkillEntity } from './entities/skill.entities';
import { SkillsService } from './skills.service';

@ApiTags('skills')
@ApiBearerAuth('access-token')
@Throttle({ default: THROTTLE_TIERS.admin })
@ApiAdminErrorResponses()
@Controller('admin/skills')
export class SkillsAdminController {
  constructor(private readonly skills: SkillsService) {}
  @Get()
  @RequirePermission('skills.read')
  @ApiOperation({ summary: 'List skills with full translations.' })
  @ApiOkEnvelope(AdminSkillEntity, { isArray: true })
  list(): Promise<AdminSkillEntity[]> {
    return this.skills.listAdmin();
  }
  @Get(':id')
  @RequirePermission('skills.read')
  @ApiOkEnvelope(AdminSkillEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Skill not found.')
  @ApiUuidParamBadRequest('skill')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminSkillEntity> {
    return this.skills.getAdmin(id);
  }
  @Post()
  @RequirePermission('skills.create')
  @ApiCreatedEnvelope(AdminSkillEntity)
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Validation error or invalid locale.',
  )
  create(@Body() dto: CreateSkillDto): Promise<AdminSkillEntity> {
    return this.skills.create(dto);
  }
  @Patch(':id')
  @RequirePermission('skills.update')
  @ApiOkEnvelope(AdminSkillEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Skill not found.')
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Validation error or invalid locale.',
  )
  @ApiUuidParamBadRequest('skill')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSkillDto,
  ): Promise<AdminSkillEntity> {
    return this.skills.update(id, dto);
  }
  @Delete(':id')
  @RequirePermission('skills.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Skill deleted.' })
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Skill not found.')
  @ApiProblemResponse(HttpStatus.CONFLICT, 'Skill is linked to a project.')
  @ApiUuidParamBadRequest('skill')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.skills.remove(id);
  }
}
