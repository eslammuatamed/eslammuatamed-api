import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import { ApiPublicReadErrorResponses } from '../../common/swagger/api-problem-response';
import { PublicTestimonialEntity } from './entities/testimonial.entities';
import { TestimonialsService } from './testimonials.service';

@ApiTags('testimonials')
@Controller('testimonials')
export class TestimonialsController {
  constructor(private readonly testimonials: TestimonialsService) {}
  @Get()
  @Public()
  @ApiOperation({ summary: 'List visible testimonials resolved to a locale.' })
  @ApiOkEnvelope(PublicTestimonialEntity)
  @ApiPublicReadErrorResponses()
  list(@Query() query: LocaleQueryDto): Promise<PublicTestimonialEntity[]> {
    return this.testimonials.listPublic(query.locale);
  }
}
