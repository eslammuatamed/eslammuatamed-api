import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiPublicReadErrorResponses } from '../../common/swagger/api-problem-response';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import { SkillsService } from './skills.service';
import { SkillQueryDto } from './dto/skill.dto';
import { PublicSkillEntity } from './entities/skill.entities';

@ApiTags('skills')
@Controller('skills')
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}
  @Get()
  @Public()
  @ApiOperation({ summary: 'List skills resolved to a locale.' })
  @ApiOkEnvelope(PublicSkillEntity, { isArray: true })
  @ApiPublicReadErrorResponses()
  list(@Query() query: SkillQueryDto): Promise<PublicSkillEntity[]> {
    return this.skills.listPublic(query.locale);
  }
}
