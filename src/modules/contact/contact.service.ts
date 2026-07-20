import { Injectable, NotFoundException } from '@nestjs/common';
import { ContactMessage, Prisma } from '@prisma/client';
import {
  buildPageMeta,
  PaginatedResult,
} from '../../common/pagination/page-meta';
import { PrismaService } from '../../prisma/prisma.service';
import { isSpam } from './anti-spam';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { MessageListQueryDto } from './dto/message-list.query.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ContactMessageEntity } from './entities/contact-message.entity';
import { ContactReceiptEntity } from './entities/contact-receipt.entity';

// Transport-agnostic intake context: the controller reads these off the request headers and hands
// them in, so the service never touches Request/Response (doc 07, principle 13).
export interface ContactIntakeContext {
  readonly userAgent?: string;
  readonly referrer?: string;
}

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  // Public intake (FR-PUB-050/051/052, D02-1). Anti-spam runs first: a tripped trap is dropped-as-
  // success — the same receipt is returned but nothing is persisted, so a bot gets no signal. A
  // genuine message is persisted with `meta` = the captured UA/referrer (empty object when absent);
  // the honeypot/time-trap fields are request-only and never written.
  async create(
    dto: CreateContactMessageDto,
    context: ContactIntakeContext,
  ): Promise<ContactReceiptEntity> {
    if (isSpam({ website: dto.website, elapsedMs: dto.elapsedMs })) {
      return { received: true };
    }

    const meta: Prisma.JsonObject = {};
    if (context.userAgent !== undefined) {
      meta.userAgent = context.userAgent;
    }
    if (context.referrer !== undefined) {
      meta.referrer = context.referrer;
    }

    await this.prisma.contactMessage.create({
      data: {
        name: dto.name,
        email: dto.email,
        subject: dto.subject,
        body: dto.body,
        meta,
      },
    });

    return { received: true };
  }

  // Admin inbox listing (FR-DSH-060): unread-first, then newest-first, backed by
  // `@@index([isArchived, isRead, createdAt])`. Optional read/archived filters.
  async list(
    query: MessageListQueryDto,
  ): Promise<PaginatedResult<ContactMessageEntity>> {
    const where: Prisma.ContactMessageWhereInput = {};
    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }
    if (query.isArchived !== undefined) {
      where.isArchived = query.isArchived;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.contactMessage.findMany({
        where,
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.contactMessage.count({ where }),
    ]);

    return new PaginatedResult(
      rows.map(toEntity),
      buildPageMeta(query.page, query.perPage, total),
    );
  }

  async getById(id: string): Promise<ContactMessageEntity> {
    return toEntity(await this.getOrThrow(id));
  }

  // Read/archive triage only (D02-4). Undefined fields are no-ops in the Prisma update.
  async update(
    id: string,
    dto: UpdateMessageDto,
  ): Promise<ContactMessageEntity> {
    await this.getOrThrow(id);
    const row = await this.prisma.contactMessage.update({
      where: { id },
      data: { isRead: dto.isRead, isArchived: dto.isArchived },
    });
    return toEntity(row);
  }

  private async getOrThrow(id: string): Promise<ContactMessage> {
    const row = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Message not found.');
    }
    return row;
  }
}

function toEntity(row: ContactMessage): ContactMessageEntity {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    body: row.body,
    isRead: row.isRead,
    isArchived: row.isArchived,
    meta: (row.meta ?? {}) as Prisma.JsonObject,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
