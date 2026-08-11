import { NotFoundException } from '@nestjs/common';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import {
  ContactMessage,
  ContactMessageReply,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactReplyService } from './contact-reply.service';
import { CreateMessageReplyDto } from './dto/create-message-reply.dto';
import { MessageNotRepliableException } from './message-not-repliable.exception';

const OPERATOR_ID = '0192f3a0-0000-7000-8000-00000000ffff';
const KEY = 'idem-key-0001';

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

const reply = (
  overrides: Partial<ContactMessageReply> = {},
): ContactMessageReply => ({
  id: 'reply-1',
  contactMessageId: 'msg-1',
  body: 'Thanks for reaching out.',
  status: 'PENDING',
  idempotencyKey: KEY,
  initiatedByUserId: OPERATOR_ID,
  providerMessageId: null,
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
  sentAt: null,
  failedAt: null,
  ...overrides,
});

const dto = (body = 'Thanks for reaching out.'): CreateMessageReplyDto => ({
  body,
});

// The shape Prisma raises when the (contactMessageId, idempotencyKey) unique index rejects an
// insert. Constructed with the real error class so the service's `instanceof` narrowing is exercised
// rather than bypassed by a plain object that merely carries a `code` property.
const uniqueViolation = (): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

describe('ContactReplyService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: ContactReplyService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new ContactReplyService(prisma);
  });

  describe('create', () => {
    it('persists the reply against the addressed message and attributes it to the authenticated operator', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(message());
      prisma.contactMessageReply.create.mockResolvedValue(reply());

      const outcome = await service.create(
        'msg-1',
        dto('Thanks for reaching out.'),
        KEY,
        OPERATOR_ID,
      );

      // Discriminating on every field the caller controls or the server derives — a test that only
      // asserted `created === true` would pass against a service that stored the wrong operator.
      expect(prisma.contactMessageReply.create).toHaveBeenCalledWith({
        data: {
          contactMessageId: 'msg-1',
          body: 'Thanks for reaching out.',
          idempotencyKey: KEY,
          initiatedByUserId: OPERATOR_ID,
        },
      });
      expect(outcome.created).toBe(true);
      expect(outcome.reply.initiatedByUserId).toBe(OPERATOR_ID);
    });

    // §28: 11A does not send, so a created attempt must be PENDING. A service that reported SENT
    // here would be claiming a delivery that provably did not happen.
    it('creates the attempt in a non-terminal state and never claims a send', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(message());
      prisma.contactMessageReply.create.mockResolvedValue(reply());

      const { reply: created } = await service.create(
        'msg-1',
        dto(),
        KEY,
        OPERATOR_ID,
      );

      expect(created.status).toBe('PENDING');
      expect(created.sentAt).toBeNull();
      expect(created.failedAt).toBeNull();
      // The status is never written by the service — the schema default is the single decider.
      const [call] = prisma.contactMessageReply.create.mock.calls;
      expect(call?.[0].data).not.toHaveProperty('status');
    });

    // The security invariant, at the persistence layer: the row's message is the one named by the
    // path, and nothing the caller supplied could redirect it.
    it('takes the message id from the resolved row, never from the caller', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(
        message({ id: 'msg-resolved' }),
      );
      prisma.contactMessageReply.create.mockResolvedValue(
        reply({ contactMessageId: 'msg-resolved' }),
      );

      await service.create('msg-resolved', dto(), KEY, OPERATOR_ID);

      expect(prisma.contactMessage.findUnique).toHaveBeenCalledWith({
        where: { id: 'msg-resolved' },
      });
    });

    it('returns the existing attempt without creating a second row when the key is replayed', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(message());
      prisma.contactMessageReply.create.mockRejectedValue(uniqueViolation());
      prisma.contactMessageReply.findUniqueOrThrow.mockResolvedValue(
        reply({ id: 'the-winner', body: 'The first body.' }),
      );

      const outcome = await service.create(
        'msg-1',
        dto('A DIFFERENT body under the same key.'),
        KEY,
        OPERATOR_ID,
      );

      expect(outcome.created).toBe(false);
      expect(outcome.reply.id).toBe('the-winner');
      // The replay returns the STORED attempt, not the body this request submitted. Same logical
      // key means same logical attempt (D02-13, §15) — a replay is not an edit.
      expect(outcome.reply.body).toBe('The first body.');
      expect(prisma.contactMessageReply.findUniqueOrThrow).toHaveBeenCalledWith(
        {
          where: {
            contactMessageId_idempotencyKey: {
              contactMessageId: 'msg-1',
              idempotencyKey: KEY,
            },
          },
        },
      );
    });

    // The catch is narrow on purpose. A broad catch would turn any write failure into a confident
    // 200 describing a row this request did not create.
    it('rethrows a non-unique-constraint database failure instead of reporting a replay', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(message());
      prisma.contactMessageReply.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('FK failed', {
          code: 'P2003',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.create('msg-1', dto(), KEY, OPERATOR_ID),
      ).rejects.toMatchObject({ code: 'P2003' });
      expect(
        prisma.contactMessageReply.findUniqueOrThrow,
      ).not.toHaveBeenCalled();
    });

    it('404s an unknown message without creating a reply or reading a recipient', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(null);

      await expect(
        service.create('missing', dto(), KEY, OPERATOR_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.contactMessageReply.create).not.toHaveBeenCalled();
    });

    // D02-10 permits a phone-only submission, so a perfectly valid stored message can have nowhere
    // to reply to. It must be a decided answer, not an attempt to mail `null`.
    it.each([
      ['null email', null],
      ['empty-string email', ''],
    ])('409s a message with no address to reply to (%s)', async (_, email) => {
      prisma.contactMessage.findUnique.mockResolvedValue(
        message({ email, phone: '+201002785408' }),
      );

      await expect(
        service.create('msg-1', dto(), KEY, OPERATOR_ID),
      ).rejects.toBeInstanceOf(MessageNotRepliableException);
    });

    // The ORDERING of the failure answers is contract (D10-21c): the key must not be claimed on a
    // message that can never be replied to, or a client burns a key it can never reuse.
    it('rejects an unrepliable message before claiming the idempotency key', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(
        message({ email: null, phone: '+201002785408' }),
      );

      await expect(
        service.create('msg-1', dto(), KEY, OPERATOR_ID),
      ).rejects.toBeInstanceOf(MessageNotRepliableException);
      expect(prisma.contactMessageReply.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns only this message’s replies, oldest first, with a deterministic tie-break', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(message());
      prisma.contactMessageReply.findMany.mockResolvedValue([reply()]);

      await service.list('msg-1');

      expect(prisma.contactMessageReply.findMany).toHaveBeenCalledWith({
        where: { contactMessageId: 'msg-1' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
    });

    // "No replies" and "no such message" are different facts and must not share a response.
    it('404s an unknown message rather than returning an empty list', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(null);

      await expect(service.list('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.contactMessageReply.findMany).not.toHaveBeenCalled();
    });

    // Reading history is not gated on repliability — the dashboard must be able to render an empty
    // state for a phone-only message it can plainly display.
    it('lists history for a phone-only message, which can never be replied to', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(
        message({ email: null, phone: '+201002785408' }),
      );
      prisma.contactMessageReply.findMany.mockResolvedValue([]);

      await expect(service.list('msg-1')).resolves.toEqual([]);
    });
  });

  describe('entity mapping', () => {
    it('publishes the reply fields the dashboard needs and withholds the provider id', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(message());
      prisma.contactMessageReply.findMany.mockResolvedValue([
        reply({
          status: 'SENT',
          providerMessageId: '<abc@smtp.internal>',
          sentAt: new Date('2026-02-01T00:05:00.000Z'),
        }),
      ]);

      const [entity] = await service.list('msg-1');

      expect(entity).toEqual({
        id: 'reply-1',
        contactMessageId: 'msg-1',
        body: 'Thanks for reaching out.',
        status: 'SENT',
        initiatedByUserId: OPERATOR_ID,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        sentAt: new Date('2026-02-01T00:05:00.000Z'),
        failedAt: null,
      });
      // Asserted by absence AND by key, not by a `not.toContain` over a serialization: an exact
      // `toEqual` above would pass against an entity carrying `providerMessageId: undefined`,
      // which would still serialize the key in some encoders.
      expect(Object.keys(entity ?? {})).not.toContain('providerMessageId');
    });
  });
});
