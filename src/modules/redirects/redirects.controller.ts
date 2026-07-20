import {
  Controller,
  Get,
  Header,
  HttpStatus,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import {
  ApiProblemResponse,
  ApiPublicReadErrorResponses,
} from '../../common/swagger/api-problem-response';
import { RedirectResolveQueryDto } from './dto/redirect-resolve.query.dto';
import { RedirectResolveEntity } from './entities/redirect-resolve.entity';
import { RedirectService } from './redirect.service';

@ApiTags('redirects')
@Controller('redirects')
export class RedirectsController {
  constructor(private readonly redirects: RedirectService) {}

  // no-store overrides the doc 10 §5 public-GET cache (D10-7): redirects are runtime data and a
  // cached miss would mask a just-created redirect (D04-6 auto-on-rename). Inherits the global
  // public throttle tier (no @Throttle override).
  @Get('resolve')
  @Public()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Resolve a website path to its current destination, or 404 when none exists.',
  })
  @ApiOkEnvelope(RedirectResolveEntity, {
    description: 'The destination path for the matched redirect.',
  })
  @ApiPublicReadErrorResponses()
  @ApiProblemResponse(
    HttpStatus.NOT_FOUND,
    'No redirect for this path in the locale.',
  )
  async resolve(
    @Query() query: RedirectResolveQueryDto,
  ): Promise<RedirectResolveEntity> {
    const result = await this.redirects.resolve(query.locale, query.path);
    if (result === null) {
      throw new NotFoundException('No redirect for this path in the locale.');
    }
    return result;
  }
}
