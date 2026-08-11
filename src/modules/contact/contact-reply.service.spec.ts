import { NotFoundException } from '@nestjs/common';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import {
  ContactMessage,
  ContactMessageReply,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactMailService } from './contact-mail.service';
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

// The provider key the service must derive for `reply-1`. Written out literally rather than by
// calling `deriveProviderIdempotencyKey`, so a change to the derivation fails this suite instead of
// being mirrored into it — a test that computes its expectation the same way as the code cannot
// tell a correct key from a wrong one.
const PROVIDER_KEY = 'contact-reply/reply-1';

const HOUR = 60 * 60 * 1000;

describe('ContactReplyService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let mail: DeepMockProxy<ContactMailService>;
  let service: ContactReplyService;

  // The mail boundary is faked, never the transport: these are DOMAIN tests, and what they pin is
  // which state a given provider OUTCOME produces. The separate structural proof that the real
  // MailService puts the right header on the wire lives at the Nodemailer seam
  // (mail.service.spec.ts) — one fake per boundary, so neither has to model the other's job.
  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    mail = mockDeep<ContactMailService>();
    service = new ContactReplyService(prisma, mail);

    // Default: the provider accepts. Tests that care about failure say so explicitly.
    mail.dispatchReply.mockResolvedValue({
      accepted: true,
      providerMessageId: '<sent@smtp.internal>',
    });
  });

  // What the database hands back after the finalize commit. The service must return THIS row rather
  // than an optimistically mutated copy of the claim, so the fixture deliberately differs from what
  // an in-memory mutation would have produced.
  const finalizesTo = (row: ContactMessageReply): void => {
    prisma.contactMessageReply.update.mockResolvedValue(row);
  };

  const sentRow = (overrides: Partial<ContactMessageReply> = {}) =>
    reply({
      status: 'SENT',
      sentAt: new Date('2026-02-01T00:00:05.000Z'),
      providerMessageId: '<sent@smtp.internal>',
      ...overrides,
    });

  const failedRow = (overrides: Partial<ContactMessageReply> = {}) =>
    reply({
      status: 'FAILED',
      failedAt: new Date('2026-02-01T00:00:05.000Z'),
      ...overrides,
    });

  describe('create', () => {
    it('persists the reply against the addressed message and attributes it to the authenticated operator', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(message());
      prisma.contactMessageReply.create.mockResolvedValue(reply());
      finalizesTo(sentRow());

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

    // The CLAIM is still non-terminal, and that ordering is the whole safety story: the row exists
    // and is PENDING before anything is handed to a transport, so a crash mid-send leaves something
    // recoverable rather than an email nobody has a record of.
    it('claims the attempt as PENDING before any send, letting the schema decide the initial state', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(message());
      prisma.contactMessageReply.create.mockResolvedValue(reply());
      finalizesTo(sentRow());

      await service.create('msg-1', dto(), KEY, OPERATOR_ID);

      // The status is never written by the service — the schema default is the single decider.
      const [call] = prisma.contactMessageReply.create.mock.calls;
      expect(call?.[0].data).not.toHaveProperty('status');
      // Ordering, asserted rather than assumed: the claim's invocation precedes the send's.
      const claimOrder =
        prisma.contactMessageReply.create.mock.invocationCallOrder[0];
      const sendOrder = mail.dispatchReply.mock.invocationCallOrder[0];
      expect(claimOrder).toBeDefined();
      expect(sendOrder).toBeDefined();
      expect(claimOrder).toBeLessThan(sendOrder as number);
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
      finalizesTo(sentRow({ contactMessageId: 'msg-resolved' }));

      await service.create('msg-resolved', dto(), KEY, OPERATOR_ID);

      expect(prisma.contactMessage.findUnique).toHaveBeenCalledWith({
        where: { id: 'msg-resolved' },
      });
    });

    it('returns the existing attempt without creating a second row when the key is replayed', async () => {
      prisma.contactMessage.findUnique.mockResolvedValue(message());
      prisma.contactMessageReply.create.mockRejectedValue(uniqueViolation());
      // SENT, so this test is about the replay LOOKUP and not about any recovery branch — the
      // stale-window rules get their own tests below rather than being smuggled in here.
      prisma.contactMessageReply.findUniqueOrThrow.mockResolvedValue(
        sentRow({ id: 'the-winner', body: 'The first body.' }),
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

  // The delivery state machine (11B-α §27). Every test here fixes one (starting state, provider
  // outcome) pair and pins the state that results, because those pairs are the whole feature: what
  // a reply IS to an operator is the status this table produces.
  describe('delivery', () => {
    // Puts a freshly-claimed PENDING row in front of the service.
    const claims = (row: ContactMessageReply = reply()): void => {
      prisma.contactMessage.findUnique.mockResolvedValue(message());
      prisma.contactMessageReply.create.mockResolvedValue(row);
    };

    // Puts an ALREADY-EXISTING row in front of it — the same-key replay path.
    const replays = (existing: ContactMessageReply): void => {
      prisma.contactMessage.findUnique.mockResolvedValue(message());
      prisma.contactMessageReply.create.mockRejectedValue(uniqueViolation());
      prisma.contactMessageReply.findUniqueOrThrow.mockResolvedValue(existing);
    };

    const finalizeCall = () =>
      prisma.contactMessageReply.update.mock.calls[0]?.[0];

    describe('a newly claimed attempt', () => {
      it('records SENT with a sent timestamp when the provider accepts', async () => {
        claims();
        finalizesTo(sentRow());

        const { reply: result } = await service.create(
          'msg-1',
          dto(),
          KEY,
          OPERATOR_ID,
        );

        expect(finalizeCall()).toEqual({
          where: { id: 'reply-1' },
          data: {
            status: 'SENT',
            sentAt: expect.any(Date) as Date,
            providerMessageId: '<sent@smtp.internal>',
          },
        });
        // The RETURNED row is the one the database gave back after the finalize, not a mutated
        // copy of the claim: the fixture's timestamp is one only the finalize read could supply.
        expect(result.status).toBe('SENT');
        expect(result.sentAt).toEqual(new Date('2026-02-01T00:00:05.000Z'));
        expect(result.failedAt).toBeNull();
      });

      it('records FAILED with a failure timestamp when the provider does not accept', async () => {
        claims();
        mail.dispatchReply.mockResolvedValue({ accepted: false });
        finalizesTo(failedRow());

        const { reply: result } = await service.create(
          'msg-1',
          dto(),
          KEY,
          OPERATOR_ID,
        );

        expect(finalizeCall()).toEqual({
          where: { id: 'reply-1' },
          data: { status: 'FAILED', failedAt: expect.any(Date) as Date },
        });
        expect(result.status).toBe('FAILED');
        expect(result.failedAt).toEqual(new Date('2026-02-01T00:00:05.000Z'));
        // No provider id is invented for a send the provider never took.
        expect(finalizeCall()?.data).not.toHaveProperty('providerMessageId');
      });

      // Every input to the send comes from stored state: the address from the message row, the text
      // and the key from the reply row. Deliberately fixtured so the claimed row's body DIFFERS
      // from the one this request submitted — a recovery re-send has no request body in scope at
      // all, so a send driven by the DTO would work here and fail exactly where it matters.
      it('sends the persisted body, to the stored address, under the key derived from the row', async () => {
        claims(reply({ body: 'The persisted body.' }));
        finalizesTo(sentRow());

        await service.create(
          'msg-1',
          dto('What this request submitted.'),
          KEY,
          OPERATOR_ID,
        );

        expect(mail.dispatchReply).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'msg-1',
            email: 'alex@example.com',
          }),
          'The persisted body.',
          PROVIDER_KEY,
          'reply-1',
        );
      });

      // §5: the provider key follows the ROW, so two deliberate attempts are two external sends
      // that the provider must not collapse into one.
      it('derives a different provider key for a different logical attempt', async () => {
        claims(reply({ id: 'reply-2' }));
        finalizesTo(sentRow({ id: 'reply-2' }));

        await service.create('msg-1', dto(), 'a-second-key', OPERATOR_ID);

        expect(mail.dispatchReply).toHaveBeenCalledWith(
          expect.anything(),
          expect.any(String),
          'contact-reply/reply-2',
          'reply-2',
        );
      });
    });

    describe('a same-key replay', () => {
      // Time is pinned INSIDE the provider window on purpose. With a stale fixture these tests
      // would pass even if the status branch fell through, because the window check would refuse
      // the send instead — they would be pinning the wrong rule. Holding the clock here makes the
      // terminal-status branch the only thing that can prevent a re-send.
      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-01T01:00:00.000Z'));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('returns an already SENT attempt without sending again', async () => {
        replays(sentRow());

        const { reply: result, created } = await service.create(
          'msg-1',
          dto(),
          KEY,
          OPERATOR_ID,
        );

        expect(created).toBe(false);
        expect(result.status).toBe('SENT');
        expect(mail.dispatchReply).not.toHaveBeenCalled();
        expect(prisma.contactMessageReply.update).not.toHaveBeenCalled();
      });

      // §9's load-bearing rule. A replay is a repeated REQUEST, not a request for a second attempt:
      // re-sending here would mail a person again on the strength of a network retry they never
      // asked for. A deliberate retry is a new key, which is a new row.
      it('returns a FAILED attempt without silently re-sending', async () => {
        replays(failedRow());

        const { reply: result, created } = await service.create(
          'msg-1',
          dto(),
          KEY,
          OPERATOR_ID,
        );

        expect(created).toBe(false);
        expect(result.status).toBe('FAILED');
        expect(mail.dispatchReply).not.toHaveBeenCalled();
        expect(prisma.contactMessageReply.update).not.toHaveBeenCalled();
      });

      // §16: the first operator owns the attempt. A replay by a colleague who also holds
      // `messages.reply` must not rewrite who the outbound email is attributed to.
      it('leaves the original operator attribution alone when another operator replays the key', async () => {
        replays(sentRow({ initiatedByUserId: 'the-first-operator' }));

        const { reply: result } = await service.create(
          'msg-1',
          dto(),
          KEY,
          'a-different-operator',
        );

        expect(result.initiatedByUserId).toBe('the-first-operator');
        const wroteOwnership =
          prisma.contactMessageReply.update.mock.calls.some(
            (call) => 'initiatedByUserId' in (call[0]?.data ?? {}),
          );
        expect(wroteOwnership).toBe(false);
      });
    });

    // The ambiguous state, and the only one where a replay may act. Time is controlled explicitly
    // — the boundary is a real 24 hours and no test may wait for it.
    describe('a PENDING attempt', () => {
      const CLAIMED_AT = new Date('2026-02-01T00:00:00.000Z');

      afterEach(() => {
        jest.useRealTimers();
      });

      const at = (offsetMs: number): void => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(CLAIMED_AT.getTime() + offsetMs));
      };

      it('re-sends under the SAME provider key while the provider window is open', async () => {
        at(23 * HOUR);
        replays(reply({ status: 'PENDING', createdAt: CLAIMED_AT }));
        finalizesTo(sentRow());

        const { reply: result, created } = await service.create(
          'msg-1',
          dto(),
          KEY,
          OPERATOR_ID,
        );

        expect(created).toBe(false);
        // Same key as the first attempt — this is what makes the re-send a provider REPLAY rather
        // than a second email. A fresh key here would duplicate the message.
        expect(mail.dispatchReply).toHaveBeenCalledWith(
          expect.anything(),
          expect.any(String),
          PROVIDER_KEY,
          'reply-1',
        );
        expect(result.status).toBe('SENT');
        // Recovery resolves the EXISTING attempt; it never opens a second one.
        expect(prisma.contactMessageReply.create).toHaveBeenCalledTimes(1);
      });

      // The boundary, pinned on both sides. `>=` refuses, so the exact expiry instant does not send.
      it.each([
        ['just inside the window', 24 * HOUR - 1, true],
        ['exactly at expiry', 24 * HOUR, false],
        ['past expiry', 25 * HOUR, false],
      ])('%s: re-sends = %s', async (_label, offset, shouldSend) => {
        at(offset);
        replays(reply({ status: 'PENDING', createdAt: CLAIMED_AT }));
        finalizesTo(sentRow());

        await service.create('msg-1', dto(), KEY, OPERATOR_ID);

        expect(mail.dispatchReply).toHaveBeenCalledTimes(shouldSend ? 1 : 0);
      });

      // A refused RECOVERY must NOT become terminal. The row was already ambiguous — the email may
      // have been accepted the first time — so a refusal now says nothing about that, and writing
      // FAILED would both invent an outcome and foreclose every later recovery, since a FAILED
      // replay never re-sends. Only the window may end recovery.
      it('stays PENDING when a recovery send is refused, rather than becoming FAILED', async () => {
        at(2 * HOUR);
        replays(reply({ status: 'PENDING', createdAt: CLAIMED_AT }));
        mail.dispatchReply.mockResolvedValue({ accepted: false });

        const { reply: result } = await service.create(
          'msg-1',
          dto(),
          KEY,
          OPERATOR_ID,
        );

        expect(mail.dispatchReply).toHaveBeenCalledTimes(1);
        expect(prisma.contactMessageReply.update).not.toHaveBeenCalled();
        expect(result.status).toBe('PENDING');
        expect(result.failedAt).toBeNull();
      });

      // The contrast that makes the rule above meaningful: a FIRST send has nothing preceding it,
      // so a refusal IS the whole story of that attempt and is recorded.
      it('records FAILED when the FIRST send is refused, unlike a recovery', async () => {
        at(0);
        prisma.contactMessage.findUnique.mockResolvedValue(message());
        prisma.contactMessageReply.create.mockResolvedValue(reply());
        mail.dispatchReply.mockResolvedValue({ accepted: false });
        finalizesTo(failedRow());

        const { reply: result } = await service.create(
          'msg-1',
          dto(),
          KEY,
          OPERATOR_ID,
        );

        expect(prisma.contactMessageReply.update).toHaveBeenCalledTimes(1);
        expect(result.status).toBe('FAILED');
      });

      // §12. Past the window the provider may no longer recognise the key, so a re-send is a
      // possible duplicate. The only safe action is none — and in particular NOT inventing a
      // terminal state for an outcome nobody knows.
      it('does nothing at all to a stale PENDING attempt', async () => {
        at(48 * HOUR);
        const stale = reply({ status: 'PENDING', createdAt: CLAIMED_AT });
        replays(stale);

        const { reply: result, created } = await service.create(
          'msg-1',
          dto(),
          KEY,
          OPERATOR_ID,
        );

        expect(created).toBe(false);
        expect(mail.dispatchReply).not.toHaveBeenCalled();
        // Not re-sent, not marked SENT, not marked FAILED, and not duplicated into a second row.
        expect(prisma.contactMessageReply.update).not.toHaveBeenCalled();
        expect(prisma.contactMessageReply.create).toHaveBeenCalledTimes(1);
        expect(result.status).toBe('PENDING');
        expect(result.sentAt).toBeNull();
        expect(result.failedAt).toBeNull();
      });
    });

    // §10 — the case the whole conservative design exists for. The provider took the message and
    // the status write did not land, so Postgres genuinely does not know the outcome.
    describe('when the provider accepts but the finalize write fails', () => {
      it('leaves the row PENDING and does not compensate with a FAILED write', async () => {
        claims();
        prisma.contactMessageReply.update.mockRejectedValue(
          new Error('connection terminated'),
        );

        await expect(
          service.create('msg-1', dto(), KEY, OPERATOR_ID),
        ).rejects.toThrow('connection terminated');

        // Exactly one write was attempted, and it was the SENT finalize. A second call marking the
        // row FAILED would be the defect: it would record an outcome that did not happen AND close
        // off the recovery that is still safe, because a FAILED replay never re-sends.
        expect(prisma.contactMessageReply.update).toHaveBeenCalledTimes(1);
        expect(finalizeCall()?.data).toMatchObject({ status: 'SENT' });
      });

      // §11 — and this is what makes the row's staying PENDING useful rather than merely honest.
      it('recovers on a same-key retry using the same provider key', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-01T00:30:00.000Z'));
        // The row as the failed finalize left it: claimed, sent, never recorded.
        replays(
          reply({
            status: 'PENDING',
            createdAt: new Date('2026-02-01T00:00:00.000Z'),
          }),
        );
        finalizesTo(sentRow());

        const { reply: result } = await service.create(
          'msg-1',
          dto(),
          KEY,
          OPERATOR_ID,
        );

        expect(mail.dispatchReply).toHaveBeenCalledWith(
          expect.anything(),
          expect.any(String),
          PROVIDER_KEY,
          'reply-1',
        );
        expect(result.status).toBe('SENT');
        jest.useRealTimers();
      });
    });

    // §17: correctness rests on the row id, the provider key and the status — never on what a
    // provider returns when it replays a key, which is undocumented for the SMTP relay.
    it('keeps a known provider message id rather than overwriting it on a recovery send', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-01T01:00:00.000Z'));
      replays(
        reply({
          status: 'PENDING',
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
          providerMessageId: '<the-original@smtp.internal>',
        }),
      );
      mail.dispatchReply.mockResolvedValue({
        accepted: true,
        providerMessageId: '<a-replay-id@smtp.internal>',
      });
      finalizesTo(sentRow());

      await service.create('msg-1', dto(), KEY, OPERATOR_ID);

      expect(finalizeCall()?.data).toMatchObject({
        providerMessageId: '<the-original@smtp.internal>',
      });
      jest.useRealTimers();
    });

    // §22: a provider failure reaches the domain as a VALUE, so there is no transport text anywhere
    // for a response or the stored history to leak. Asserted on the row the caller receives.
    it('exposes no provider diagnostics on the returned attempt', async () => {
      claims();
      mail.dispatchReply.mockResolvedValue({ accepted: false });
      finalizesTo(failedRow());

      const { reply: result } = await service.create(
        'msg-1',
        dto(),
        KEY,
        OPERATOR_ID,
      );

      expect(Object.keys(result).sort()).toEqual([
        'body',
        'contactMessageId',
        'createdAt',
        'failedAt',
        'id',
        'initiatedByUserId',
        'sentAt',
        'status',
      ]);
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
