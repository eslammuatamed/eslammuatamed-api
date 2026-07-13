import { Body, Controller, Get, HttpStatus, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RequirePermission } from '../access-control/decorators/require-permission.decorator';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import {
  ApiAdminErrorResponses,
  ApiProblemResponse,
} from '../../common/swagger/api-problem-response';
import { THROTTLE_TIERS } from '../../common/throttling/throttle-tiers';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { AdminSiteSettingsEntity } from './entities/site-settings.entities';
import { SettingsService } from './settings.service';

// Settings management is gated by the settings.* permission keys (doc 19 §3, D19-8). The OWNER
// system role holds the reserved '*' grant, so it retains full access; any custom role granted
// settings.read/settings.update gets exactly that surface.
@ApiTags('settings')
@ApiBearerAuth('access-token')
@Throttle({ default: THROTTLE_TIERS.admin })
@ApiAdminErrorResponses()
@Controller('admin/settings')
export class SettingsAdminController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermission('settings.read')
  @ApiOperation({
    summary: 'Full site settings with the per-locale translation map.',
  })
  @ApiOkEnvelope(AdminSiteSettingsEntity)
  get(): Promise<AdminSiteSettingsEntity> {
    return this.settingsService.getAdminSettings();
  }

  @Patch()
  @RequirePermission('settings.update')
  @ApiOperation({
    summary: 'Update site settings, incl. FR-DSH-052 head/tag fields.',
  })
  @ApiOkEnvelope(AdminSiteSettingsEntity, {
    description: 'The updated settings.',
  })
  @ApiProblemResponse(HttpStatus.UNPROCESSABLE_ENTITY, 'Validation error.')
  update(@Body() dto: UpdateSettingsDto): Promise<AdminSiteSettingsEntity> {
    return this.settingsService.updateSettings(dto);
  }
}
