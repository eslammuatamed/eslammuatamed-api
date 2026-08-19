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
  ApiUuidParamBadRequest,
} from '../../common/swagger/api-problem-response';
import { THROTTLE_TIERS } from '../../common/throttling/throttle-tiers';
import { RequirePermission } from '../access-control/decorators/require-permission.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { AdminCategoryEntity } from './entities/category.entities';

// Each method declares its categories.* permission (doc 19 §3, D19-8); a role granted those
// keys (or the OWNER '*') can manage categories.
@ApiTags('taxonomy')
@ApiBearerAuth('access-token')
@Throttle({ default: THROTTLE_TIERS.admin })
@ApiAdminErrorResponses()
@Controller('admin/categories')
export class CategoriesAdminController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermission('categories.read')
  @ApiOperation({ summary: 'List categories with full translation maps.' })
  @ApiOkEnvelope(AdminCategoryEntity, { isArray: true })
  list(): Promise<AdminCategoryEntity[]> {
    return this.categories.listAdmin();
  }

  @Post()
  @RequirePermission('categories.create')
  @ApiOperation({ summary: 'Create a category with its translations.' })
  @ApiCreatedEnvelope(AdminCategoryEntity)
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Validation error or slug already in use.',
  )
  create(@Body() dto: CreateCategoryDto): Promise<AdminCategoryEntity> {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @RequirePermission('categories.update')
  @ApiOperation({ summary: 'Upsert category translations.' })
  @ApiOkEnvelope(AdminCategoryEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Category not found.')
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Validation error or slug already in use.',
  )
  @ApiUuidParamBadRequest('category')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<AdminCategoryEntity> {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('categories.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a category (409 if articles still reference it).',
  })
  @ApiNoContentResponse({ description: 'Category deleted.' })
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Category not found.')
  @ApiProblemResponse(
    HttpStatus.CONFLICT,
    'Category is still referenced by articles.',
  )
  @ApiUuidParamBadRequest('category')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.categories.remove(id);
  }
}
