import { NotFoundException } from '@nestjs/common';
import { ContactMessage } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactService } from './contact.service';
import { MessageListQueryDto } from './dto/message-list.query.dto';

const message = (overrides: Partial<ContactMessage> = {}): ContactMessage => ({
  id: 'msg-1',
  name: 'Alex Morgan',
  email: 'alex@example.com',
  phone: null,
  subject: 'Project inquiry',
  body: 'I would like to discuss a Nuxt build.',
  isRead: false,
  isArchived: false,
  archivedAt: null,
  meta: {},
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const validDto = {
  name: 'Alex Morgan',
  email: 'alex@example.com',
  subject: 'Project inquiry',
  body: 'I would like to discuss a Nuxt build.',
};

const listQuery = (
  overrides: Partial<MessageListQueryDto> = {},
): MessageListQueryDto => ({
  page: 1,
  perPage: 12,
  skip: 0,
  take: 12,
  ...overrides,
});

describe('ContactService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: ContactService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new ContactService(prisma);
  });

  describe('create — intake + anti-spam', () => {
    it('persists a valid message and returns the receipt', async () => {
      prisma.contactMessage.create.mockResolvedValue(message());

      // A genuine submission carries a human fill time; absent elapsedMs is itself a spam signal.
      const receipt = await service.create(
        { ...validDto, elapsedMs: 9000 },
        { userAgent: 'Mozilla/5.0', referrer: 'https://example.com' },
      );

      expect(receipt).toEqual({ received: true });
      expect(prisma.contactMessage.create).toHaveBeenCalledTimes(1);
    });

    it('captures userAgent + referrer into meta, excluding the anti-spam fields', async () => {
      prisma.contactMessage.create.mockResolvedValue(message());

      await service.create(
        { ...validDto, website: '', elapsedMs: 9000 },
        { userAgent: 'Mozilla/5.0', referrer: 'https://example.com' },
      );

      expect(prisma.contactMessage.create).toHaveBeenCalledWith({
        data: {
          name: validDto.name,
          email: validDto.email,
          // An absent method is written as SQL NULL, never left undefined (D09-19): the column is
          // nullable and the CHECK constraint reads NULL, not "key omitted".
          phone: null,
          subject: validDto.subject,
          body: validDto.body,
          meta: { userAgent: 'Mozilla/5.0', referrer: 'https://example.com' },
        },
      });
    });

    it('writes meta = {} when both headers are absent', async () => {
      prisma.contactMessage.create.mockResolvedValue(message());

      await service.create({ ...validDto, elapsedMs: 9000 }, {});

      expect(prisma.contactMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ meta: {} }),
      });
    });

    it('drops a filled honeypot as success: same receipt, nothing persisted', async () => {
      const receipt = await service.create(
        { ...validDto, website: 'http://bot.example', elapsedMs: 9000 },
        { userAgent: 'ua' },
      );

      expect(receipt).toEqual({ received: true });
      expect(prisma.contactMessage.create).not.toHaveBeenCalled();
    });

    it('drops a sub-threshold elapsedMs as success: same receipt, nothing persisted', async () => {
      const receipt = await service.create(
        { ...validDto, elapsedMs: 500 },
        { userAgent: 'ua' },
      );

      expect(receipt).toEqual({ received: true });
      expect(prisma.contactMessage.create).not.toHaveBeenCalled();
    });

    it('drops an absent elapsedMs as success (no fill time = bot)', async () => {
      const receipt = await service.create(validDto, {});

      expect(receipt).toEqual({ received: true });
      expect(prisma.contactMessage.create).not.toHaveBeenCalled();
    });
  });

  describe('list — inbox', () => {
    it('lists unread-first then newest-first, paginated, into the envelope shape', async () => {
      prisma.$transaction.mockResolvedValue([[message()], 1] as never);

      const result = await service.list(listQuery());

      expect(prisma.contactMessage.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        skip: 0,
        take: 12,
      });
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        perPage: 12,
        total: 1,
        totalPages: 1,
      });
    });

    it('applies the isRead / isArchived filters when provided', async () => {
      prisma.$transaction.mockResolvedValue([[], 0] as never);

      await service.list(listQuery({ isRead: false, isArchived: true }));

      expect(prisma.contactMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isRead: false, isArchived: true } }),
      );
      expect(prisma.contactMessage.count).toHaveBeenCalledWith({
        where: { isRead: false, isArchived: true },
      });
    });

    it('maps a row into the entity, exposing meta', async () => {
      prisma.$transaction.mockResolvedValue([
        [message({ meta: { userAgent: 'ua' } })],
        1,
      ] as never);

      const result = await service.list(listQuery());

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          id: 'msg-1',
          email: 'alex@example.com',
          isRead: false,
          isArchived: false,
          meta: { userAgent: 'ua' },
        }),
      );
    });
  });

  describe('getById', () => {
    it('returns the message when it exists', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(message());

      const result = await service.getById('msg-1');

      expect(result.id).toBe('msg-1');
    });

    it('throws NotFound when the message is absent', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(null);

      await expect(service.getById('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update — read/archive toggle + archivedAt maintenance (D09-14)', () => {
    it('toggles isRead / isArchived and returns the updated entity', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(message());
      prisma.contactMessage.update.mockResolvedValue(
        message({ isRead: true, isArchived: true, archivedAt: new Date() }),
      );

      const result = await service.update('msg-1', {
        isRead: true,
        isArchived: true,
      });

      expect(result.isRead).toBe(true);
      expect(result.isArchived).toBe(true);
    });

    it('sets archivedAt to now when archiving a previously-unarchived message (false->true)', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(
        message({ isArchived: false, archivedAt: null }),
      );
      prisma.contactMessage.update.mockResolvedValue(
        message({ isArchived: true, archivedAt: new Date() }),
      );

      await service.update('msg-1', { isArchived: true });

      expect(prisma.contactMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: {
          isRead: undefined,
          isArchived: true,
          archivedAt: expect.any(Date),
        },
      });
    });

    it('clears archivedAt to null when un-archiving (true->false)', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(
        message({
          isArchived: true,
          archivedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      );
      prisma.contactMessage.update.mockResolvedValue(
        message({ isArchived: false, archivedAt: null }),
      );

      await service.update('msg-1', { isArchived: false });

      expect(prisma.contactMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { isRead: undefined, isArchived: false, archivedAt: null },
      });
    });

    it('does not touch archivedAt when isArchived is unchanged (already archived, re-sent true)', async () => {
      const archivedAt = new Date('2026-01-01T00:00:00.000Z');
      prisma.contactMessage.findUnique.mockResolvedValue(
        message({ isArchived: true, archivedAt }),
      );
      prisma.contactMessage.update.mockResolvedValue(
        message({ isRead: true, isArchived: true, archivedAt }),
      );

      await service.update('msg-1', { isRead: true, isArchived: true });

      expect(prisma.contactMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { isRead: true, isArchived: true },
      });
    });

    it('does not touch archivedAt when isArchived is omitted (isRead-only update)', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(
        message({ isArchived: false, archivedAt: null }),
      );
      prisma.contactMessage.update.mockResolvedValue(message({ isRead: true }));

      await service.update('msg-1', { isRead: true });

      expect(prisma.contactMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { isRead: true, isArchived: undefined },
      });
    });

    it('throws NotFound when updating a missing message', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { isRead: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.contactMessage.update).not.toHaveBeenCalled();
    });
  });

  describe('purgeArchivedOlderThan — retention (doc 19 §6, D19-10)', () => {
    it('hard-deletes only archived rows whose archivedAt is before the cutoff, and returns the count', async () => {
      const cutoff = new Date('2025-07-20T00:00:00.000Z');
      prisma.contactMessage.deleteMany.mockResolvedValue({ count: 3 });

      const deleted = await service.purgeArchivedOlderThan(cutoff);

      expect(prisma.contactMessage.deleteMany).toHaveBeenCalledWith({
        where: { isArchived: true, archivedAt: { not: null, lt: cutoff } },
      });
      expect(deleted).toBe(3);
    });

    it('returns 0 when nothing is eligible (no delete side effects beyond the scoped query)', async () => {
      prisma.contactMessage.deleteMany.mockResolvedValue({ count: 0 });

      const deleted = await service.purgeArchivedOlderThan(
        new Date('2025-07-20T00:00:00.000Z'),
      );

      expect(deleted).toBe(0);
      expect(prisma.contactMessage.deleteMany).toHaveBeenCalledTimes(1);
    });
  });
});
