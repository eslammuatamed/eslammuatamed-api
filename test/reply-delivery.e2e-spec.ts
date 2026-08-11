import { Test } from '@nestjs/testing';
import { PrismaClient } from '../src/generated/prisma/client';
import { ContactMailService } from '../src/modules/contact/contact-mail.service';
import {
  ContactReplyService,
  ReplyCreateOutcome,
} from '../src/modules/contact/contact-reply.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppConfigModule } from '../src/config/config.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { createPrismaClient } from '../src/prisma/standalone-client';

// Reply delivery against a REAL PostgreSQL, at the service/database seam (11B-α §26).
//
// Deliberately not through HTTP. What needs a real database here is the persistence half of the
// state machine — that one logical key yields exactly one row no matter how many callers race for
// it, that the row's operator never moves, and that each status transition actually lands. None of
// that involves the request pipeline, and going through HTTP would add auth, pipes and an envelope
// between the assertion and the thing asserted. 11B-β owns the full HTTP matrix.
//
// NO MAIL IS SENT. `ContactMailService` is replaced by a fake at the module boundary, so the real
// MailService is never constructed and no transport exists to reach. The fake is also the only way
// to drive a provider OUTCOME on demand — a disabled real transport can only ever say "no".

const DAY_MS = 24 * 60 * 60 * 1000;

// Models the provider, not the mail service: it records every domain call, and separately records
// how many DISTINCT external sends those calls would actually have produced. The distinction is
// the point (§14) — two callers may both legitimately reach the transport with the same key, and
// what must never happen is two emails.
class FakeProvider {
  readonly calls: { key: string; to: string; body: string }[] = [];
  private readonly keys = new Set<string>();
  private outcome: { accepted: boolean; providerMessageId?: string | null } = {
    accepted: true,
    providerMessageId: '<accepted@fake>',
  };

  refuse(): void {
    this.outcome = { accepted: false };
  }

  // Distinct external emails: one per idempotency key, which is exactly the guarantee the real
  // provider documents for a key it has seen inside its retention window.
  get externalSends(): number {
    return this.keys.size;
  }

  asService(): ContactMailService {
    const dispatchReply = (
      message: { email: string },
      body: string,
      key: string,
    ) => {
      this.calls.push({ key, to: message.email, body });
      this.keys.add(key);
      return Promise.resolve(
        this.outcome.accepted
          ? {
              accepted: true as const,
              providerMessageId: this.outcome.providerMessageId ?? null,
            }
          : { accepted: false as const },
      );
    };
    return { dispatchReply } as unknown as ContactMailService;
  }
}

describe('Reply delivery (service/database seam, e2e)', () => {
  let service: ContactReplyService;
  let db: PrismaClient;
  let provider: FakeProvider;
  let operatorId: string;

  const messageWith = async (email: string | null = 'visitor@example.com') => {
    const row = await db.contactMessage.create({
      data: {
        name: 'Alex Morgan',
        email,
        phone: email === null ? '+201002785408' : null,
        subject: 'Website enquiry',
        body: 'I would like to discuss a Nuxt build.',
        meta: {},
      },
    });
    return row.id;
  };

  const reply = (messageId: string, key: string, body = 'Thanks.') =>
    service.create(messageId, { body }, key, operatorId);

  const rowsFor = (messageId: string) =>
    db.contactMessageReply.findMany({ where: { contactMessageId: messageId } });

  beforeAll(async () => {
    db = createPrismaClient(process.env.DATABASE_URL ?? '');
    // Any real user satisfies the RESTRICT foreign key; the seeded owner is the one that exists.
    const owner = await db.user.findFirstOrThrow();
    operatorId = owner.id;
  });

  beforeEach(async () => {
    provider = new FakeProvider();
    const moduleRef = await Test.createTestingModule({
      // AppConfigModule is @Global in the running app, which a standalone testing module does not
      // inherit — PrismaService reads its DSN from it, so it is imported explicitly here.
      imports: [AppConfigModule, PrismaModule],
      providers: [
        ContactReplyService,
        { provide: ContactMailService, useValue: provider.asService() },
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(ContactReplyService);
    // The real PrismaService the module built, pointed at the scratch database like every other
    // e2e suite — the service under test is wired exactly as production wires it.
    expect(moduleRef.get(PrismaService)).toBeDefined();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe('one logical key, one row', () => {
    it('creates a single row for a repeated key and delivers exactly once', async () => {
      const messageId = await messageWith();

      const first = await reply(messageId, 'key-a');
      const second = await reply(messageId, 'key-a', 'A different body.');

      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(await rowsFor(messageId)).toHaveLength(1);
      // The replay found a SENT row and sent nothing — one call, one email.
      expect(provider.calls).toHaveLength(1);
      expect(provider.externalSends).toBe(1);
      // A replay is not an edit: the stored body is the first one.
      expect(second.reply.body).toBe('Thanks.');
    });

    // §14 — the load-bearing concurrency invariant, on the real unique index. No sleeps: the two
    // creates are issued together and the database decides which one wins.
    it('yields one row and no duplicate email when two callers race the same key', async () => {
      const messageId = await messageWith();

      const outcomes = await Promise.allSettled([
        reply(messageId, 'key-race'),
        reply(messageId, 'key-race'),
      ]);

      // Both requests must succeed — losing the insert race is the idempotency guarantee firing,
      // not an error to surface.
      const fulfilled = outcomes.filter(
        (o): o is PromiseFulfilledResult<ReplyCreateOutcome> =>
          o.status === 'fulfilled',
      );
      expect(fulfilled).toHaveLength(2);
      expect(fulfilled.filter((o) => o.value.created)).toHaveLength(1);

      // The invariant, both halves. One row in the database...
      const rows = await rowsFor(messageId);
      expect(rows).toHaveLength(1);
      // ...and at most one external email, however many domain calls reached the provider. The
      // call count is recorded rather than asserted to be 1: both callers CAN legitimately reach
      // the transport (the loser may find the row still PENDING), and it is provider idempotency,
      // not call count, that stops the second email.
      expect(provider.externalSends).toBe(1);
      expect(provider.calls.length).toBeGreaterThanOrEqual(1);
      expect(new Set(provider.calls.map((c) => c.key)).size).toBe(1);
    });

    // §15 — two deliberate attempts are two rows and two sends. A design that serialized the whole
    // message's reply stream would fail here.
    it('creates separate rows and separate sends for different keys', async () => {
      const messageId = await messageWith();

      const first = await reply(messageId, 'key-1', 'First.');
      const second = await reply(messageId, 'key-2', 'Second.');

      expect(first.created).toBe(true);
      expect(second.created).toBe(true);
      expect(first.reply.id).not.toBe(second.reply.id);
      expect(await rowsFor(messageId)).toHaveLength(2);
      expect(provider.externalSends).toBe(2);
      // Distinct provider keys, each derived from its own row.
      expect(provider.calls.map((c) => c.key).sort()).toEqual([
        `contact-reply/${first.reply.id}`,
        `contact-reply/${second.reply.id}`,
      ]);
    });

    // The same key against a DIFFERENT message is a different logical attempt — this is why the
    // unique index is scoped to the message rather than global (D09-23).
    it('treats one key against two messages as two independent attempts', async () => {
      const a = await messageWith();
      const b = await messageWith();

      const first = await reply(a, 'shared-key');
      const second = await reply(b, 'shared-key');

      expect(second.created).toBe(true);
      expect(second.reply.contactMessageId).toBe(b);
      expect(first.reply.id).not.toBe(second.reply.id);
    });
  });

  describe('persisted state', () => {
    it('persists SENT with a timestamp when the provider accepts', async () => {
      const messageId = await messageWith();

      const { reply: result } = await reply(messageId, 'key-sent');

      const [row] = await rowsFor(messageId);
      expect(row?.status).toBe('SENT');
      expect(row?.sentAt).toBeInstanceOf(Date);
      expect(row?.failedAt).toBeNull();
      expect(row?.providerMessageId).toBe('<accepted@fake>');
      // What the caller receives is what the database holds — read back after the commit.
      expect(result.status).toBe('SENT');
      expect(result.sentAt).toEqual(row?.sentAt);
    });

    it('persists FAILED with a timestamp when the provider refuses', async () => {
      const messageId = await messageWith();
      provider.refuse();

      const { reply: result } = await reply(messageId, 'key-failed');

      const [row] = await rowsFor(messageId);
      expect(row?.status).toBe('FAILED');
      expect(row?.failedAt).toBeInstanceOf(Date);
      expect(row?.sentAt).toBeNull();
      // Nothing is invented for a send the provider never took.
      expect(row?.providerMessageId).toBeNull();
      expect(result.status).toBe('FAILED');
    });

    // §9 — the rule an operator's mail account depends on. A repeated request after a failure must
    // not put a second copy in flight.
    it('never re-sends a FAILED attempt on a same-key replay', async () => {
      const messageId = await messageWith();
      provider.refuse();
      await reply(messageId, 'key-retry');
      const callsAfterFirst = provider.calls.length;

      const { reply: result, created } = await reply(messageId, 'key-retry');

      expect(created).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(provider.calls).toHaveLength(callsAfterFirst);
      expect(await rowsFor(messageId)).toHaveLength(1);
    });

    // §16 — the record of who sent an email must not move to whoever repeated the request.
    it('keeps the first operator’s attribution when another operator replays the key', async () => {
      const messageId = await messageWith();
      // A second real operator. The role is connected to the seeded owner's rather than invented,
      // so this user is authorized exactly as the first one is — the test is about ATTRIBUTION,
      // not about permissions, and a differently-privileged user would muddle the two.
      const owner = await db.user.findUniqueOrThrow({
        where: { id: operatorId },
      });
      const other = await db.user.create({
        data: {
          email: `replay-operator-${Date.now()}@example.com`,
          passwordHash: 'not-a-real-hash',
          roleId: owner.roleId,
        },
      });

      const first = await reply(messageId, 'key-owner');
      const second = await service.create(
        messageId,
        { body: 'Mine now.' },
        'key-owner',
        other.id,
      );

      expect(second.reply.initiatedByUserId).toBe(operatorId);
      expect(second.reply.initiatedByUserId).not.toBe(other.id);
      const [row] = await rowsFor(messageId);
      expect(row?.initiatedByUserId).toBe(first.reply.initiatedByUserId);
    });
  });

  // §12 — the stale-PENDING rule, against a row the database really holds. The 24-hour boundary is
  // reached by BACKDATING the row rather than by waiting for it.
  describe('a PENDING attempt past the provider window', () => {
    const staleReply = async (messageId: string, ageMs: number) => {
      const row = await db.contactMessageReply.create({
        data: {
          contactMessageId: messageId,
          body: 'An attempt whose outcome was never recorded.',
          idempotencyKey: 'key-stale',
          initiatedByUserId: operatorId,
          createdAt: new Date(Date.now() - ageMs),
        },
      });
      return row;
    };

    it('re-sends under the original key while the window is open', async () => {
      const messageId = await messageWith();
      const stale = await staleReply(messageId, DAY_MS - 60_000);

      const { reply: result } = await reply(messageId, 'key-stale');

      expect(provider.calls).toHaveLength(1);
      expect(provider.calls[0]?.key).toBe(`contact-reply/${stale.id}`);
      expect(result.status).toBe('SENT');
      expect(await rowsFor(messageId)).toHaveLength(1);
    });

    it('does nothing to an attempt older than the window', async () => {
      const messageId = await messageWith();
      await staleReply(messageId, DAY_MS + 60_000);

      const { reply: result, created } = await reply(messageId, 'key-stale');

      expect(created).toBe(false);
      // Not re-sent...
      expect(provider.calls).toHaveLength(0);
      expect(provider.externalSends).toBe(0);
      // ...and not resolved into a state nobody knows to be true.
      const [row] = await rowsFor(messageId);
      expect(row?.status).toBe('PENDING');
      expect(row?.sentAt).toBeNull();
      expect(row?.failedAt).toBeNull();
      expect(result.status).toBe('PENDING');
      // And never duplicated into a second row.
      expect(await rowsFor(messageId)).toHaveLength(1);
    });
  });

  // The recipient invariant, at the persistence layer: the address the provider is handed comes
  // from the stored message and from nowhere else (D19-12).
  it('sends to the address on the stored message', async () => {
    const messageId = await messageWith('someone-specific@example.com');

    await reply(messageId, 'key-recipient');

    expect(provider.calls[0]?.to).toBe('someone-specific@example.com');
  });
});
