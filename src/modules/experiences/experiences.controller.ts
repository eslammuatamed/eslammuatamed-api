import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import { ApiPublicReadErrorResponses } from '../../common/swagger/api-problem-response';
import { ExperienceQueryDto } from './dto/experience.dto';
import { PublicExperienceEntity } from './entities/experience.entities';
import { ExperiencesService } from './experiences.service';

@ApiTags('experiences')
@Controller('experiences')
export class ExperiencesController {
  constructor(private readonly experiences: ExperiencesService) {}
  @Get()
  @Public()
  @ApiOperation({ summary: 'List experiences resolved to a locale.' })
  @ApiOkEnvelope(PublicExperienceEntity, { isArray: true })
  @ApiPublicReadErrorResponses()
  list(@Query() query: ExperienceQueryDto): Promise<PublicExperienceEntity[]> {
    return this.experiences.listPublic(query.locale);
  }
}
