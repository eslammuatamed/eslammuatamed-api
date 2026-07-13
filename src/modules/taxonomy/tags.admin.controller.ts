import {
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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
} from '../../common/swagger/api-envelope';
import {
  ApiAdminErrorResponses,
  ApiProblemResponse,
} from '../../common/swagger/api-problem-response';
import { THROTTLE_TIERS } from '../../common/throttling/throttle-tiers';
import { RequirePermission } from '../access-control/decorators/require-permission.decorator';
import { CreateTagDto, UpdateTagDto } from './dto/tag.dto';
import { AdminTagEntity } from './entities/tag.entities';
import { TagsService } from './tags.service';

@ApiTags('taxonomy')
@ApiBearerAuth('access-token')
@Throttle({ default: THROTTLE_TIERS.admin })
@ApiAdminErrorResponses()
@Controller('admin/tags')
export class TagsAdminController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @RequirePermission('tags.read')
  @ApiOperation({ summary: 'List tags with full translation maps.' })
  @ApiOkEnvelope(AdminTagEntity)
  list(): Promise<AdminTagEntity[]> {
    return this.tags.listAdmin();
  }

  @Post()
  @RequirePermission('tags.create')
  @ApiOperation({ summary: 'Create a tag with its translations.' })
  @ApiCreatedEnvelope(AdminTagEntity)
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Validation error or slug already in use.',
  )
  create(@Body() dto: CreateTagDto): Promise<AdminTagEntity> {
    return this.tags.create(dto);
  }

  @Patch(':id')
  @RequirePermission('tags.update')
  @ApiOperation({ summary: 'Upsert tag translations.' })
  @ApiOkEnvelope(AdminTagEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Tag not found.')
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Validation error or slug already in use.',
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTagDto,
  ): Promise<AdminTagEntity> {
    return this.tags.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('tags.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tag.' })
  @ApiNoContentResponse({ description: 'Tag deleted.' })
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Tag not found.')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.tags.remove(id);
  }
}
