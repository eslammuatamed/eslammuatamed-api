import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import { ApiPublicReadErrorResponses } from '../../common/swagger/api-problem-response';
import { PublicSiteSettingsEntity } from './entities/site-settings.entities';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('site')
  @Public()
  @ApiOperation({ summary: 'Resolved site settings for the requested locale.' })
  @ApiOkEnvelope(PublicSiteSettingsEntity, {
    description: 'Public settings resolved to ?locale=.',
  })
  @ApiPublicReadErrorResponses()
  getSite(@Query() query: LocaleQueryDto): Promise<PublicSiteSettingsEntity> {
    return this.settingsService.getPublicSettings(query.locale);
  }
}
