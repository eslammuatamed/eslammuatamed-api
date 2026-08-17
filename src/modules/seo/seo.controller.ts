import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import {
  ApiProblemResponse,
  ApiPublicReadErrorResponses,
} from '../../common/swagger/api-problem-response';
import { PublicPageSeoEntity } from './entities/page-seo.entities';
import { PAGE_SEO_KEYS } from './page-keys';
import { SeoService } from './seo.service';

@ApiTags('seo')
@Controller('seo')
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  /**
   * `pageKey` is taken as a RAW param and validated in the service, deliberately — not through the
   * `@IsIn` DTO the admin routes use.
   *
   * An unknown key on a public GET is an unknown resource, so the honest status is 404. Routing it
   * through the validation pipe would make it a 422 and, worse, put the entire valid key set into the
   * error message of an unauthenticated endpoint. The enum still reaches the contract through
   * `@ApiParam` below, so the Dashboard and the generated types see the closed set (D09-24) without
   * the public surface having to enumerate it in an error.
   */
  @Get('pages/:pageKey')
  @Public()
  @ApiOperation({
    summary: 'Static-page SEO overrides resolved to the requested locale.',
    description:
      'An OVERRIDE layer, not a content record (FR-DSH-051, D10-24). A known page key with nothing authored for the requested locale returns 200 with every field null, which tells the caller to use the site defaults instead (doc 22 §3, F-D4) — 404 is reserved for a page key outside the known set, so "nothing authored" and "no such page" stay distinguishable. No cross-locale fallback (D10-6).',
  })
  @ApiParam({ name: 'pageKey', enum: PAGE_SEO_KEYS, example: 'about' })
  @ApiOkEnvelope(PublicPageSeoEntity)
  @ApiPublicReadErrorResponses()
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Unknown static page key.')
  getPage(
    @Param('pageKey') pageKey: string,
    @Query() query: LocaleQueryDto,
  ): Promise<PublicPageSeoEntity> {
    return this.seo.getPublic(pageKey, query.locale);
  }
}
