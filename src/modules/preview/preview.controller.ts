import {
  Controller,
  Get,
  Header,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import {
  ApiProblemResponse,
  ApiPublicReadErrorResponses,
  ApiUuidParamBadRequest,
} from '../../common/swagger/api-problem-response';
import { ArticlesService } from '../articles/articles.service';
import { PublicArticleDetailEntity } from '../articles/entities/article.entities';
import { ProjectsService } from '../projects/projects.service';
import { PublicProjectDetailEntity } from '../projects/entities/project.entities';
import { PreviewConsumeQueryDto } from './dto/preview-consume.query.dto';
import { PreviewTokenService } from './preview-token.service';

// Public draft-preview consume routes (D10-8). The preview TOKEN is the sole visibility gate: a
// missing, garbage, expired, tampered, or wrong-type token yields 404 — never 401/403 — so an
// unauthorized caller cannot distinguish a real draft from an absent one (FR-PUB-046, draft
// invisibility). On a valid token the draft is returned in the same resolved single-locale shape as
// a public read, with no-store so the credentialed draft never lands in a shared cache.
@ApiTags('preview')
@Controller('preview')
export class PreviewController {
  constructor(
    private readonly previewTokens: PreviewTokenService,
    private readonly articles: ArticlesService,
    private readonly projects: ProjectsService,
  ) {}

  @Get('articles/:id')
  @Public()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Preview an article of any status with a valid token, else 404.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkEnvelope(PublicArticleDetailEntity, {
    description: 'The draft article resolved to ?locale=.',
  })
  @ApiPublicReadErrorResponses()
  @ApiProblemResponse(
    HttpStatus.NOT_FOUND,
    'Missing/invalid/expired token, or no such article.',
  )
  @ApiUuidParamBadRequest()
  async previewArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PreviewConsumeQueryDto,
  ): Promise<PublicArticleDetailEntity> {
    // verify() is the trust boundary and never throws: false ⇒ 404 (never 401/403). `?? ''` keeps
    // the argument strictly typed and maps an absent token to '' — which verify rejects — so a
    // garbage or missing token can never become a 500.
    if (!this.previewTokens.verify('article', id, query.token ?? '')) {
      throw new NotFoundException('Article not found.');
    }
    return this.articles.getPreviewById(id, query.locale);
  }

  @Get('projects/:id')
  @Public()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Preview a project of any status with a valid token, else 404.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkEnvelope(PublicProjectDetailEntity, {
    description: 'The unpublished project resolved to ?locale=.',
  })
  @ApiPublicReadErrorResponses()
  @ApiProblemResponse(
    HttpStatus.NOT_FOUND,
    'Missing/invalid/expired token, or no such project.',
  )
  @ApiUuidParamBadRequest()
  async previewProject(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PreviewConsumeQueryDto,
  ): Promise<PublicProjectDetailEntity> {
    if (!this.previewTokens.verify('project', id, query.token ?? '')) {
      throw new NotFoundException('Project not found.');
    }
    return this.projects.getPreviewById(id, query.locale);
  }
}
