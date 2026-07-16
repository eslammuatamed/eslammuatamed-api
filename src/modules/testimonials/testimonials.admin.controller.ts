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
import {
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
  @ApiOkEnvelope(AdminTestimonialEntity, { isArray: true })
  list(): Promise<AdminTestimonialEntity[]> {
    return this.testimonials.listAdmin();
  }
  @Get(':id')
  @RequirePermission('testimonials.read')
  @ApiOkEnvelope(AdminTestimonialEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Testimonial not found.')
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
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.testimonials.remove(id);
  }
}
