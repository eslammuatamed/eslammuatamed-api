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
  Query,
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
  ApiOkPaginated,
} from '../../common/swagger/api-envelope';
import { PaginatedResult } from '../../common/pagination/page-meta';
import {
  ApiAdminErrorResponses,
  ApiProblemResponse,
  ApiUuidParamBadRequest,
} from '../../common/swagger/api-problem-response';
import { THROTTLE_TIERS } from '../../common/throttling/throttle-tiers';
import { RequirePermission } from '../access-control/decorators/require-permission.decorator';
import {
  AdminTestimonialListQueryDto,
  CreateTestimonialDto,
  UpdateTestimonialDto,
} from './dto/testimonial.dto';
import { AdminTestimonialEntity } from './entities/testimonial.entities';
import { TestimonialsService } from './testimonials.service';

@ApiTags('testimonials')
@ApiBearerAuth('access-token')
@Throttle({ default: THROTTLE_TIERS.admin })
@ApiAdminErrorResponses()
@Controller('admin/testimonials')
export class TestimonialsAdminController {
  constructor(private readonly testimonials: TestimonialsService) {}
  @Get()
  @RequirePermission('testimonials.read')
  @ApiOperation({ summary: 'List testimonials including hidden entries.' })
  @ApiOkPaginated(AdminTestimonialEntity)
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Malformed pagination query parameters: page must be at least 1, perPage must be 1 through 50, and unknown fields are rejected.',
  )
  list(
    @Query() query: AdminTestimonialListQueryDto,
  ): Promise<PaginatedResult<AdminTestimonialEntity>> {
    return this.testimonials.listAdmin(query);
  }
  @Get(':id')
  @RequirePermission('testimonials.read')
  @ApiOkEnvelope(AdminTestimonialEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Testimonial not found.')
  @ApiUuidParamBadRequest('testimonial')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminTestimonialEntity> {
    return this.testimonials.getAdmin(id);
  }
  @Post()
  @RequirePermission('testimonials.create')
  @ApiCreatedEnvelope(AdminTestimonialEntity)
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Validation error or invalid locale.',
  )
  create(@Body() dto: CreateTestimonialDto): Promise<AdminTestimonialEntity> {
    return this.testimonials.create(dto);
  }
  @Patch(':id')
  @RequirePermission('testimonials.update')
  @ApiOkEnvelope(AdminTestimonialEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Testimonial not found.')
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Validation error or invalid locale.',
  )
  @ApiUuidParamBadRequest('testimonial')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTestimonialDto,
  ): Promise<AdminTestimonialEntity> {
    return this.testimonials.update(id, dto);
  }
  @Delete(':id')
  @RequirePermission('testimonials.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Testimonial deleted.' })
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Testimonial not found.')
  @ApiUuidParamBadRequest('testimonial')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.testimonials.remove(id);
  }
}
