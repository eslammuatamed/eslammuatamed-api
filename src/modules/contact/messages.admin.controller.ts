import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PaginatedResult } from '../../common/pagination/page-meta';
import {
  ApiOkEnvelope,
  ApiOkPaginated,
} from '../../common/swagger/api-envelope';
import {
  ApiAdminErrorResponses,
  ApiProblemResponse,
} from '../../common/swagger/api-problem-response';
import { THROTTLE_TIERS } from '../../common/throttling/throttle-tiers';
import { RequirePermission } from '../access-control/decorators/require-permission.decorator';
import { ContactService } from './contact.service';
import { MessageListQueryDto } from './dto/message-list.query.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ContactMessageEntity } from './entities/contact-message.entity';

// Admin inbox (FR-DSH-060, D02-4): read + triage only. No create route (a message is created solely
// by the public intake — there is no `messages.create` key) and no reply route.
@ApiTags('messages')
@ApiBearerAuth('access-token')
@Throttle({ default: THROTTLE_TIERS.admin })
@ApiAdminErrorResponses()
@Controller('admin/messages')
export class MessagesAdminController {
  constructor(private readonly contact: ContactService) {}

  @Get()
  @RequirePermission('messages.read')
  @ApiOperation({
    summary: 'List contact messages, unread-first, with read/archived filters.',
  })
  @ApiOkPaginated(ContactMessageEntity)
  list(
    @Query() query: MessageListQueryDto,
  ): Promise<PaginatedResult<ContactMessageEntity>> {
    return this.contact.list(query);
  }

  @Get(':id')
  @RequirePermission('messages.read')
  @ApiOperation({ summary: 'Get one contact message.' })
  @ApiOkEnvelope(ContactMessageEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Message not found.')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ContactMessageEntity> {
    return this.contact.getById(id);
  }

  @Patch(':id')
  @RequirePermission('messages.update')
  @ApiOperation({ summary: 'Toggle read/archived state on a contact message.' })
  @ApiOkEnvelope(ContactMessageEntity)
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Message not found.')
  @ApiProblemResponse(HttpStatus.UNPROCESSABLE_ENTITY, 'Validation error.')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMessageDto,
  ): Promise<ContactMessageEntity> {
    return this.contact.update(id, dto);
  }
}
