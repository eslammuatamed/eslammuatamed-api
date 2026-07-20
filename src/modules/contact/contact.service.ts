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
  // Maintains `archivedAt` (D09-14) on the archive transition — the retention-purge basis
  // (doc 19 §6, D19-10): set to now when a message is archived (false->true), cleared when it
  // is un-archived (true->false), and left untouched when `isArchived` is absent or unchanged.
  // `archivedAt` is server-managed and never accepted from the client DTO.
  async update(
    id: string,
    dto: UpdateMessageDto,
  ): Promise<ContactMessageEntity> {
    const existing = await this.getOrThrow(id);

    const data: Prisma.ContactMessageUpdateInput = {
      isRead: dto.isRead,
      isArchived: dto.isArchived,
    };
    if (dto.isArchived === true && !existing.isArchived) {
      data.archivedAt = new Date();
    } else if (dto.isArchived === false && existing.isArchived) {
      data.archivedAt = null;
    }

    const row = await this.prisma.contactMessage.update({
      where: { id },
      data,
    });
    return toEntity(row);
  }

  // Retention purge (doc 19 §6, D19-10): hard-delete archived messages whose archival instant is
  // older than `cutoff`. Keyed on `archivedAt` (D09-14) so only genuinely-archived rows are
  // eligible; unarchived rows (archivedAt = null) are always retained. Returns the deleted count
  // for the scheduler's count-only log line (no PII, D07-5). Invoked by ContactPurgeScheduler.
  async purgeArchivedOlderThan(cutoff: Date): Promise<number> {
    const { count } = await this.prisma.contactMessage.deleteMany({
      where: { isArchived: true, archivedAt: { not: null, lt: cutoff } },
    });
    return count;
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
    archivedAt: row.archivedAt,
    meta: (row.meta ?? {}) as Prisma.JsonObject,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
