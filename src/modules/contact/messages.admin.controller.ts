import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { PaginatedResult } from '../../common/pagination/page-meta';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiOkPaginated,
} from '../../common/swagger/api-envelope';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import {
  ApiAdminErrorResponses,
  ApiProblemResponse,
} from '../../common/swagger/api-problem-response';
import { THROTTLE_TIERS } from '../../common/throttling/throttle-tiers';
import { RequirePermission } from '../access-control/decorators/require-permission.decorator';
import { ContactReplyService } from './contact-reply.service';
import { ContactService } from './contact.service';
import { CreateMessageReplyDto } from './dto/create-message-reply.dto';
import { MessageListQueryDto } from './dto/message-list.query.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ContactMessageReplyEntity } from './entities/contact-message-reply.entity';
import { ContactMessageEntity } from './entities/contact-message.entity';
import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  IDEMPOTENCY_KEY_MIN_LENGTH,
  IdempotencyKey,
  IdempotencyKeyPipe,
} from './idempotency-key.pipe';

// Admin inbox (FR-DSH-060). Read, triage, and — as of D02-13 — reply by email. There is still no
// create route: a message is created solely by the public intake, and there is no `messages.create`
// key. The reply routes live HERE rather than on a controller of their own, both because a reply has
// no identity apart from the message it answers and because `route-permissions.spec.ts` scans a
// hand-maintained controller list — a new controller would need registering there to be covered at
// all, and an unregistered one reads as "these keys authorize nothing".
@ApiTags('messages')
@ApiBearerAuth('access-token')
@Throttle({ default: THROTTLE_TIERS.admin })
@ApiAdminErrorResponses()
@Controller('admin/messages')
export class MessagesAdminController {
  constructor(
    private readonly contact: ContactService,
    private readonly replies: ContactReplyService,
  ) {}

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

  // Reply history (D10-21f). Guarded by `messages.read`, not `messages.reply`: reading who answered
  // a message is an inspection of the inbox, and a role that may read the inbox but not send should
  // still see whether a message was answered. Available on every message, including a phone-only
  // one that can never be replied to, where it is an empty list.
  @Get(':id/replies')
  @RequirePermission('messages.read')
  @ApiOperation({
    summary:
      'List the reply attempts for one contact message, chronologically.',
    description:
      'Ordered by `createdAt` ascending, tie-broken by `id` — reply ids are time-ordered UUIDv7, so ' +
      'the tie-break is chronologically meaningful and two identical requests cannot disagree. ' +
      "Scoped strictly to `:id`: no other message's attempts appear. " +
      'An empty array and a 404 are DIFFERENT facts and must not be conflated — a 404 means no such ' +
      'message, while `200 []` means the message exists and has no reply attempts. The latter ' +
      'includes a phone-only message that carries no email address and therefore can never be ' +
      'replied to at all: its history is readable and empty, even though POSTing to it answers 409.',
  })
  @ApiOkEnvelope(ContactMessageReplyEntity, { isArray: true })
  @ApiProblemResponse(
    HttpStatus.BAD_REQUEST,
    'The message id in the path is not a well-formed UUID.',
  )
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Message not found.')
  listReplies(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContactMessageReplyEntity[]> {
    return this.replies.list(id);
  }

  // Send one plain-text reply (D02-13, D10-21).
  //
  // The recipient is NOT a parameter of this route. It is derived from `:id`'s stored row inside the
  // service, and `CreateMessageReplyDto` has no field that could carry one — so there is nothing on
  // this signature an attacker could aim at (D19-12).
  //
  // The status code varies with the outcome, which is why the response is injected: a first create
  // is 201, an idempotent replay is 200. `@HttpCode(OK)` sets the declared default and the create
  // path raises it, so a replay can never claim it created a resource (D10-21c). `passthrough`
  // keeps the body flowing through the ordinary envelope interceptor.
  @Post(':id/replies')
  @RequirePermission('messages.reply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Send a plain-text reply to a contact message. The recipient is the message sender and cannot be chosen.',
    description:
      'Idempotent per (message, Idempotency-Key): a repeated request with the same key returns the ' +
      'existing attempt with 200 instead of sending again. A deliberate second reply uses a new key. ' +
      'The response carries the outcome as `status` — a request that reaches the provider returns ' +
      'SENT, one the provider does not accept returns FAILED with 201/200 rather than an error, ' +
      'since the attempt was recorded either way. An attempt left PENDING has an unknown outcome ' +
      'and may be recovered by repeating the request with the SAME key within 24 hours; after that ' +
      'it is returned unchanged and never re-sent automatically.',
  })
  @ApiHeader({
    name: IDEMPOTENCY_KEY_HEADER,
    required: true,
    description:
      `An opaque client-generated value, ${IDEMPOTENCY_KEY_MIN_LENGTH}–${IDEMPOTENCY_KEY_MAX_LENGTH} ` +
      'printable ASCII characters without whitespace (a UUID is the obvious choice). Scoped to this ' +
      'message: the same key against a different message is a different logical attempt.',
    schema: {
      type: 'string',
      minLength: IDEMPOTENCY_KEY_MIN_LENGTH,
      maxLength: IDEMPOTENCY_KEY_MAX_LENGTH,
    },
  })
  @ApiCreatedEnvelope(ContactMessageReplyEntity)
  @ApiOkEnvelope(ContactMessageReplyEntity)
  @ApiProblemResponse(
    HttpStatus.BAD_REQUEST,
    'The message id in the path is not a well-formed UUID.',
  )
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'Message not found.')
  @ApiProblemResponse(
    HttpStatus.CONFLICT,
    'The message carries no email address and cannot be replied to.',
  )
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Validation error — including a missing or malformed Idempotency-Key header.',
  )
  async createReply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageReplyDto,
    @IdempotencyKey(IdempotencyKeyPipe) idempotencyKey: string,
    @Req() req: Request & { user?: AuthenticatedUser },
    @Res({ passthrough: true }) res: Response,
  ): Promise<ContactMessageReplyEntity> {
    // Non-null by construction: the global JwtAuthGuard runs ahead of this handler and PermissionsGuard
    // has already resolved this principal's grants to authorize `messages.reply`, so an unauthenticated
    // request never reaches here. Asserted rather than defaulted — a fallback operator id would attribute
    // a real outbound email to the wrong person, which is worse than failing loudly.
    const operatorId = req.user?.id;
    if (operatorId === undefined) {
      throw new UnauthorizedException();
    }

    const { reply, created } = await this.replies.create(
      id,
      dto,
      idempotencyKey,
      operatorId,
    );
    if (created) {
      res.status(HttpStatus.CREATED);
    }
    return reply;
  }
}
