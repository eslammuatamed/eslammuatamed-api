import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import {
  ApiAdminErrorResponses,
  ApiProblemResponse,
} from '../../common/swagger/api-problem-response';
import { THROTTLE_TIERS } from '../../common/throttling/throttle-tiers';
import { RequirePermission } from '../access-control/decorators/require-permission.decorator';
import { PageSeoKeyParamDto, UpdatePageSeoDto } from './dto/page-seo.dto';
import { AdminPageSeoEntity } from './entities/page-seo.entities';
import { SeoService } from './seo.service';

/**
 * The SEO module's static-page surface (FR-DSH-051, F-D4, D10-24).
 *
 * There is deliberately no create or delete verb. The page set is closed and code-defined (D09-24),
 * so a row's existence is not something an operator decides — `PATCH` upserts, and clearing every
 * field with nulls (D10-23) is what "remove the overrides" means. A `DELETE` would be a second way
 * to express the same state, and a `POST` would imply the operator can invent a page.
 *
 * FR-DSH-052's global head/tag fields (verification tokens, GTM, custom metas) stay on the settings
 * singleton under `settings.*`, not here: they belong to the site, not to a page. The Dashboard
 * presents both in one SEO module, but the authorization boundary follows the data.
 */
@ApiTags('seo')
@ApiBearerAuth('access-token')
@Throttle({ default: THROTTLE_TIERS.admin })
@ApiAdminErrorResponses()
@Controller('admin/seo/pages')
export class SeoAdminController {
  constructor(private readonly seo: SeoService) {}

  @Get()
  @RequirePermission('seo.read')
  @ApiOperation({
    summary: 'List every static page with its full per-locale SEO map.',
    description:
      'One entry per known page key (D09-24), each carrying every enabled locale — an unauthored locale arrives all-null so the editor can render its tab.',
  })
  @ApiOkEnvelope(AdminPageSeoEntity, { isArray: true })
  list(): Promise<AdminPageSeoEntity[]> {
    return this.seo.listAdmin();
  }

  @Get(':pageKey')
  @RequirePermission('seo.read')
  @ApiOperation({ summary: 'Read one static page’s SEO map, all locales.' })
  @ApiOkEnvelope(AdminPageSeoEntity)
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Unknown static page key (the set is closed — D09-24).',
  )
  get(@Param() params: PageSeoKeyParamDto): Promise<AdminPageSeoEntity> {
    return this.seo.getAdmin(params.pageKey);
  }

  @Patch(':pageKey')
  @RequirePermission('seo.update')
  @ApiOperation({
    summary: 'Upsert one static page’s SEO values per locale.',
    description:
      'Locales present in the body are upserted; locales absent from it are untouched. Within a field, an omitted key preserves the stored value and an explicit null clears it (D10-23). All locales apply in one transaction.',
  })
  @ApiOkEnvelope(AdminPageSeoEntity)
  @ApiProblemResponse(
    HttpStatus.BAD_REQUEST,
    'Unknown or disabled locale in a translation entry.',
  )
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Unknown static page key, malformed field, or an ogImageId that is missing or not an IMAGE.',
  )
  update(
    @Param() params: PageSeoKeyParamDto,
    @Body() dto: UpdatePageSeoDto,
  ): Promise<AdminPageSeoEntity> {
    return this.seo.update(params.pageKey, dto);
  }
}
