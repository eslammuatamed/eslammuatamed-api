import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import { ApiPublicReadErrorResponses } from '../../common/swagger/api-problem-response';
import { PublicTagEntity } from './entities/tag.entities';
import { TagsService } from './tags.service';

@ApiTags('taxonomy')
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List tags resolved to the requested locale.' })
  @ApiOkEnvelope(PublicTagEntity, {
    description: 'Tags in the requested locale.',
    isArray: true,
  })
  @ApiPublicReadErrorResponses()
  list(@Query() query: LocaleQueryDto): Promise<PublicTagEntity[]> {
    return this.tags.listPublic(query.locale);
  }
}
