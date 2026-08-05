import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import { ApiPublicReadErrorResponses } from '../../common/swagger/api-problem-response';
import { PublicSiteSettingsEntity } from './entities/site-settings.entities';
import { PUBLIC_SITE_SETTINGS_RESPONSE_EXAMPLES } from './site-settings.examples';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('site')
  @Public()
  @ApiOperation({ summary: 'Resolved site settings for the requested locale.' })
  // The named examples are what make `?locale=` OBSERVABLE IN THE CONTRACT. The schema's property
  // examples are locale-blind, so a mock replaying this operation answered every locale with the
  // English identity; `en`/`ar` here are complete, locale-representative bodies a consumer can
  // select by name. Documentation only — resolution itself stays in the service (D10-6).
  @ApiOkEnvelope(PublicSiteSettingsEntity, {
    description: 'Public settings resolved to ?locale=.',
    examples: PUBLIC_SITE_SETTINGS_RESPONSE_EXAMPLES,
  })
  @ApiPublicReadErrorResponses()
  getSite(@Query() query: LocaleQueryDto): Promise<PublicSiteSettingsEntity> {
    return this.settingsService.getPublicSettings(query.locale);
  }
}
