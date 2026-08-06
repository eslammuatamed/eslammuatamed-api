import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ContactThrottlerGuard } from '../../common/throttling/contact-throttler.guard';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import {
  ApiProblemResponse,
  RETRY_AFTER_HEADER,
} from '../../common/swagger/api-problem-response';
import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { ContactReceiptEntity } from './entities/contact-receipt.entity';

// The platform's single conversion point (D02-1). Public and route-throttled: the committed
// ContactThrottlerGuard applies its own 3/hour + 10/day per-IP windows via @UseGuards (NOT a global
// throttler). UA/referrer are read here and passed to the service so the service stays transport-
// agnostic. 200 (not 201): a submission may be silently dropped, so "created" would be a lie — and
// the receipt is identical either way, revealing nothing to a bot.
@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @Public()
  @UseGuards(ContactThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Submit a contact message. Returns an identical receipt whether the message is stored or ' +
      'silently dropped by anti-spam.',
  })
  @ApiOkEnvelope(ContactReceiptEntity, {
    description: 'The message was received (or silently dropped as spam).',
  })
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Validation error (missing field, invalid email, or unknown property).',
  )
  @ApiProblemResponse(
    HttpStatus.TOO_MANY_REQUESTS,
    'Contact rate limit exceeded (3 / hour or 10 / day per IP). Carries `Retry-After` in seconds.',
    RETRY_AFTER_HEADER,
  )
  submit(
    @Body() dto: CreateContactMessageDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('referer') referrer?: string,
  ): Promise<ContactReceiptEntity> {
    return this.contact.create(dto, { userAgent, referrer });
  }
}
