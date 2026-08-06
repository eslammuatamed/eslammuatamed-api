import {
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AppConfigService } from '../../config/app-config.service';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import {
  ApiAdminErrorResponses,
  ApiProblemResponse,
} from '../../common/swagger/api-problem-response';
import { THROTTLE_TIERS } from '../../common/throttling/throttle-tiers';
import { RequirePermission } from '../access-control/decorators/require-permission.decorator';
import { ArticlesService } from '../articles/articles.service';
import { ProjectsService } from '../projects/projects.service';
import { PreviewTokenEntity } from './entities/preview-token.entity';
import {
  PreviewEntityType,
  PreviewTokenService,
} from './preview-token.service';

// Dedicated per-type mint endpoints (D10-11): one guarded function per resource, each requiring the
// entity's own *.update permission, so the OpenAPI authz surface is explicit and no token ever leaks
// into an admin GET/list response. Mint returns 200 (not 201) via @HttpCode: nothing is persisted —
// a stateless HMAC token is derived, not a resource created. no-store keeps the credential out of any
// shared cache. The token/url are NEVER logged (only the entity id is ever touched here). The response
// `url` is an ABSOLUTE rendered-Web link (D10-11 v1.4.1): the API signs, the Web renders.
@ApiTags('preview')
@ApiBearerAuth('access-token')
@Throttle({ default: THROTTLE_TIERS.admin })
@ApiAdminErrorResponses()
@Controller('admin')
export class PreviewAdminController {
  constructor(
    private readonly previewTokens: PreviewTokenService,
    private readonly articles: ArticlesService,
    private readonly projects: ProjectsService,
    private readonly config: AppConfigService,
  ) {}

  @Post('articles/:id/preview-token')
  @RequirePermission('articles.update')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Mint a preview token for an article of any status (drafts included).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkEnvelope(PreviewTokenEntity, {
    description:
      'The minted token, its absolute rendered-Web preview url, and its expiry.',
  })
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Article not found.')
  async mintArticleToken(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreviewTokenEntity> {
    // Existence check via the exported service — 404 for an unknown id (admin convention), before
    // any token is minted for a non-existent entity.
    await this.articles.getAdmin(id);
    return this.buildToken('article', 'articles', id);
  }

  @Post('projects/:id/preview-token')
  @RequirePermission('projects.update')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Mint a preview token for a project of any status (unpublished included).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkEnvelope(PreviewTokenEntity, {
    description:
      'The minted token, its absolute rendered-Web preview url, and its expiry.',
  })
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Project not found.')
  async mintProjectToken(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreviewTokenEntity> {
    await this.projects.getAdmin(id);
    return this.buildToken('project', 'projects', id);
  }

  // Two axes that must not be confused: `entityType` (singular) binds the token's MAC and matches the
  // consume verify() call; `routeSegment` (plural) matches the rendered Web route path (D10-11 v1.4.1).
  // `url` is the ABSOLUTE Web link the dashboard shares verbatim — the Web page then renders the draft
  // by calling the consuming API GET /api/v1/preview/{routeSegment}/{id}?token= (D10-8). publicWebUrl is
  // already trailing-slash-normalized in config, so no "//" here.
  private buildToken(
    entityType: PreviewEntityType,
    routeSegment: 'articles' | 'projects',
    id: string,
  ): PreviewTokenEntity {
    const { token, expiresAt } = this.previewTokens.mint(entityType, id);
    const url = `${this.config.publicWebUrl}/preview/${routeSegment}/${id}?token=${token}`;
    return { token, url, expiresAt };
  }
}
