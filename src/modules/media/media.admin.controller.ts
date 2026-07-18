import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { DataWithMeta } from '../../common/http/data-with-meta';
import { PaginatedResult } from '../../common/pagination/page-meta';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiOkPaginated,
} from '../../common/swagger/api-envelope';
import {
  ApiAdminErrorResponses,
  ApiProblemResponse,
} from '../../common/swagger/api-problem-response';
import { THROTTLE_TIERS } from '../../common/throttling/throttle-tiers';
import { RequirePermission } from '../access-control/decorators/require-permission.decorator';
import { MediaListQueryDto } from './dto/media-list-query.dto';
import { UpdateMediaAltDto } from './dto/update-media-alt.dto';
import { AdminMediaAssetEntity } from './entities/admin-media-asset.entity';
import { MediaUsageEntity } from './entities/media-usage.entity';
import { MAX_UPLOAD_BYTES } from './media-processing.constants';
import { MediaService } from './media.service';
import { RetryAfterInterceptor } from './retry-after.interceptor';

// Admin media library (doc 10 §5). Thin controller (D07-1): the multipart boundary + the dynamic
// 201/200 status live here; all orchestration is in MediaService. Every route is permission-guarded
// (never @Public) via the global default-deny PermissionsGuard. The 10/min upload rate throttle is
// wired in T8; the in-process 2-wide processing cap (Q3) lives in the service + RetryAfterInterceptor.
@ApiTags('media')
@ApiBearerAuth('access-token')
@Throttle({ default: THROTTLE_TIERS.admin })
@ApiAdminErrorResponses()
@Controller('admin/media')
export class MediaAdminController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @RequirePermission('media.create')
  @UseInterceptors(
    // Multer defaults to in-memory storage, so `file.buffer` feeds the processor directly. The
    // 10 MiB cap is enforced here (multipart) independently of the 1 MiB JSON body limit.
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
    RetryAfterInterceptor,
  )
  @ApiOperation({
    summary:
      'Upload an image or the resume PDF. A byte-identical duplicate returns the existing asset with meta.deduplicated=true (200).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedEnvelope(AdminMediaAssetEntity, {
    description: 'A new asset was created.',
  })
  @ApiOkEnvelope(AdminMediaAssetEntity, {
    description:
      'A byte-identical asset already existed; returned with meta.deduplicated=true.',
  })
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Unsupported type, spoofed content, oversized image, or malformed PDF.',
  )
  @ApiProblemResponse(
    HttpStatus.TOO_MANY_REQUESTS,
    'Processing capacity reached; retry after the Retry-After delay.',
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    | AdminMediaAssetEntity
    | DataWithMeta<AdminMediaAssetEntity, { deduplicated: true }>
  > {
    if (!file) {
      throw new BadRequestException('A file part named "file" is required.');
    }

    const outcome = await this.media.upload({
      buffer: file.buffer,
      originalFilename: file.originalname,
      declaredMimeType: file.mimetype,
    });

    if (outcome.deduplicated) {
      // Existing asset → 200 with the meta envelope (the create default is 201).
      res.status(HttpStatus.OK);
      return new DataWithMeta(outcome.asset, { deduplicated: true as const });
    }
    return outcome.asset;
  }

  @Get()
  @RequirePermission('media.read')
  @ApiOperation({
    summary:
      'List media assets (newest first) with search over filename + alt text and a kind filter.',
  })
  @ApiOkPaginated(AdminMediaAssetEntity)
  list(
    @Query() query: MediaListQueryDto,
  ): Promise<PaginatedResult<AdminMediaAssetEntity>> {
    return this.media.list(query);
  }

  @Get(':id')
  @RequirePermission('media.read')
  @ApiOperation({
    summary: 'Get one media asset with its variants and alt text.',
  })
  @ApiOkEnvelope(AdminMediaAssetEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Media asset not found.')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminMediaAssetEntity> {
    return this.media.getAdmin(id);
  }

  @Patch(':id')
  @RequirePermission('media.update')
  @ApiOperation({
    summary:
      'Set or clear a locale alt for an image asset ("" = decorative, null = remove).',
  })
  @ApiOkEnvelope(AdminMediaAssetEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Media asset not found.')
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Alt text is not allowed on a PDF asset, or the locale is invalid.',
  )
  updateAlt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMediaAltDto,
  ): Promise<AdminMediaAssetEntity> {
    return this.media.updateAlt(id, dto);
  }

  @Get(':id/usages')
  @RequirePermission('media.read')
  @ApiOperation({
    summary: 'List every record that references this asset (blocks deletion).',
  })
  @ApiOkEnvelope(MediaUsageEntity, { isArray: true })
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Media asset not found.')
  usages(@Param('id', ParseUUIDPipe) id: string): Promise<MediaUsageEntity[]> {
    return this.media.usages(id);
  }

  @Delete(':id')
  @RequirePermission('media.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Media asset and its objects deleted.' })
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Media asset not found.')
  @ApiProblemResponse(
    HttpStatus.CONFLICT,
    'The asset is referenced; the response body enumerates its usages.',
  )
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.media.remove(id);
  }
}
