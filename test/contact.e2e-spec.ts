import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createE2eApp,
  envelopeData,
  httpServer,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from './utils/e2e-app';
import { loadApiSpec } from './utils/contract';
import { PrismaService } from '../src/prisma/prisma.service';

// Contact intake + inbox (doc 18 §2, FR-PUB-050/051/052, FR-DSH-060, D02-1/4). Requires a
// migrated + seeded eslammuatamed_test database.
//
// Throttle isolation: POST /contact is guarded by the route-local ContactThrottlerGuard, keyed
// purely on the trusted client IP (3/hour + 10/day). createE2eApp() does not enable `trust proxy`,
// so without intervention every request would share the one 127.0.0.1 bucket and the suite would
// self-429. We enable `trust proxy` on THIS suite's own Express instance (each suite builds its own
// app via createE2eApp, and e2e runs --runInBand, so this never leaks into another suite) and hand
// every contact request a distinct X-Forwarded-For IP. The guard counts BEFORE the handler runs, so
// even a dropped-as-success (honeypot/time-trap) or a 422 request consumes its IP's bucket — hence a
// fresh IP per REQUEST, not per test. The 429 test is the sole place we pin one IP and fire 4.
interface Msg {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly subject: string;
  readonly body: string;
  readonly isRead: boolean;
  readonly isArchived: boolean;
  readonly meta: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface PageMeta {
  readonly total: number;
  readonly totalPages: number;
  readonly page: number;
  readonly perPage: number;
}

// getInstance<T>() is generic; a minimal structural type keeps this strict without importing the
// express type surface.
interface TrustProxyApp {
  set(setting: string, value: unknown): unknown;
}

describe('Contact (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  const unique = Date.now();

  // A fresh documentation-range IP (TEST-NET-3, 203.0.113.0/24) per contact REQUEST, so each gets
  // its own throttle bucket. The suite makes well under 254 contact requests.
  let ipCounter = 0;
  const nextIp = (): string => `203.0.113.${(ipCounter++ % 250) + 1}`;

  const auth = (): Record<string, string> => ({
    Authorization: `Bearer ${ownerToken}`,
  });

  const subjectFor = (label: string): string =>
    `E2E contact ${label} ${unique}`;

  const validBody = (subject: string): Record<string, unknown> => ({
    name: 'Alex Morgan',
    email: 'alex@example.com',
    subject,
    body: "I'd like to discuss a Nuxt build with an opaque markdown message body.",
    elapsedMs: 8200,
  });

  // A fresh-IP contact POST. Returns the supertest response (status asserted by the caller).
  const submitContact = (
    body: Record<string, unknown>,
    ip: string = nextIp(),
  ): request.Test =>
    request(httpServer(app))
      .post('/api/v1/contact')
      .set('X-Forwarded-For', ip)
      .send(body);

  const pageMeta = (res: request.Response): PageMeta =>
    (res.body as { meta: PageMeta }).meta;

  // The first page of unread messages, newest-first. A just-created (or a wrongly-persisted)
  // message is the newest unread, so it lands at the top of this page — making both a presence
  // check and an absence check reliable regardless of how many messages prior runs accumulated.
  const listNewestUnread = async (): Promise<Msg[]> => {
    const res = await request(httpServer(app))
      .get('/api/v1/admin/messages?isRead=false&perPage=50&page=1')
      .set(auth())
      .expect(200);
    expect(res).toSatisfyApiSpec();
    return envelopeData<Msg[]>(res);
  };

  // Pages through the full listing in order until every target subject is seen (or pages are
  // exhausted), so a relative-order assertion holds even as the table accumulates across runs.
  const collectUntil = async (subjects: string[]): Promise<Msg[]> => {
    const targets = new Set(subjects);
    const collected: Msg[] = [];
    let page = 1;
    for (;;) {
      const res = await request(httpServer(app))
        .get(`/api/v1/admin/messages?perPage=50&page=${page}`)
        .set(auth())
        .expect(200);
      expect(res).toSatisfyApiSpec();
      collected.push(...envelopeData<Msg[]>(res));
      const seen = collected.filter((m) => targets.has(m.subject)).length;
      if (seen >= targets.size || page >= pageMeta(res).totalPages) {
        break;
      }
      page += 1;
    }
    return collected;
  };

  // Create a genuinely-persisted message and return its inbox row (with id). The row is the newest
  // unread at creation time, so it is on the first unread page.
  const createPersistedMessage = async (subject: string): Promise<Msg> => {
    const submit = await submitContact(validBody(subject)).expect(200);
    expect(submit).toSatisfyApiSpec();
    const row = (await listNewestUnread()).find((m) => m.subject === subject);
    expect(row).toBeDefined();
    return row as Msg;
  };

  beforeAll(async () => {
    loadApiSpec();
    app = await createE2eApp();
    // Trust the X-Forwarded-For header on this suite's app so req.ip (the throttle key) reflects
    // the per-request IP we send. Scoped to this app instance only.
    (app.getHttpAdapter().getInstance() as TrustProxyApp).set(
      'trust proxy',
      true,
    );

    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
    ownerToken = envelopeData<{ accessToken: string }>(login).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a valid submission (200 receipt) and stores it in the inbox with UA/referrer captured', async () => {
    const subject = subjectFor('valid');
    const userAgent = `e2e-agent-${unique}`;
    const referrer = 'https://referrer.example/contact';
    // Send explicit UA/Referer so meta capture (FR-004-04) is exercised; supertest sends no
    // User-Agent by default, in which case meta is the empty-object default (also correct).
    const res = await request(httpServer(app))
      .post('/api/v1/contact')
      .set('X-Forwarded-For', nextIp())
      .set('User-Agent', userAgent)
      .set('Referer', referrer)
      .send(validBody(subject))
      .expect(200);
    expect(res).toSatisfyApiSpec();
    expect(envelopeData<{ received: boolean }>(res)).toEqual({
      received: true,
    });

    const row = (await listNewestUnread()).find((m) => m.subject === subject);
    expect(row).toBeDefined();
    expect(row).toMatchObject({
      name: 'Alex Morgan',
      email: 'alex@example.com',
      subject,
      isRead: false,
      isArchived: false,
    });
    // meta is spam forensics captured at intake (FR-004-04).
    expect(row?.meta).toMatchObject({ userAgent, referrer });
  });

  it('rejects an invalid body (missing name, malformed email) with a contract-valid 422', async () => {
    const res = await submitContact({
      email: 'not-an-email',
      subject: subjectFor('invalid'),
      body: 'x',
      elapsedMs: 8200,
    }).expect(422);
    expect(res).toSatisfyApiSpec();
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('returns an identical 200 receipt but persists nothing when the honeypot is filled', async () => {
    const subject = subjectFor('honeypot');
    const res = await submitContact({
      ...validBody(subject),
      website: 'http://spam.example',
    }).expect(200);
    expect(res).toSatisfyApiSpec();
    expect(envelopeData<{ received: boolean }>(res)).toEqual({
      received: true,
    });

    // Were it persisted it would be the newest unread — its absence from that page proves the drop.
    expect((await listNewestUnread()).some((m) => m.subject === subject)).toBe(
      false,
    );
  });

  it('returns a 200 receipt but persists nothing when the fill time is under the threshold', async () => {
    const subject = subjectFor('timetrap');
    const res = await submitContact({
      ...validBody(subject),
      elapsedMs: 500,
    }).expect(200);
    expect(res).toSatisfyApiSpec();
    expect(envelopeData<{ received: boolean }>(res)).toEqual({
      received: true,
    });

    expect((await listNewestUnread()).some((m) => m.subject === subject)).toBe(
      false,
    );
  });

  it('rate-limits a 4th submission from one IP within the hour (429 + Retry-After)', async () => {
    const pinnedIp = '203.0.113.253';
    for (let i = 0; i < 3; i += 1) {
      await submitContact(validBody(subjectFor(`burst-${i}`)), pinnedIp).expect(
        200,
      );
    }
    const blocked = await submitContact(
      validBody(subjectFor('burst-4th')),
      pinnedIp,
    ).expect(429);
    expect(blocked).toSatisfyApiSpec();
    // doc 19 §6: a plain Retry-After (not a throttler-name-suffixed variant) on the 429.
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.headers['retry-after-contact-hourly']).toBeUndefined();
  });

  it('lists messages unread-first even when an unread message is older than a read one', async () => {
    // Discriminating case: unread must sort before read even against recency. Create OLD (older,
    // left unread), then NEW (newer), then mark NEW read. unread-first ⇒ OLD before NEW; a naive
    // newest-first would put NEW first. Asserting OLD before NEW proves isRead ASC dominates.
    const oldSubject = subjectFor('order-old-unread');
    const newSubject = subjectFor('order-new-read');
    await createPersistedMessage(oldSubject);
    const newer = await createPersistedMessage(newSubject);
    await request(httpServer(app))
      .patch(`/api/v1/admin/messages/${newer.id}`)
      .set(auth())
      .send({ isRead: true })
      .expect(200);

    const all = await collectUntil([oldSubject, newSubject]);
    const oldIdx = all.findIndex((m) => m.subject === oldSubject);
    const newIdx = all.findIndex((m) => m.subject === newSubject);
    expect(oldIdx).toBeGreaterThanOrEqual(0);
    expect(newIdx).toBeGreaterThanOrEqual(0);
    expect(oldIdx).toBeLessThan(newIdx);
  });

  it('filters the inbox by isRead and isArchived', async () => {
    const subject = subjectFor('filters');
    const row = await createPersistedMessage(subject);
    await request(httpServer(app))
      .patch(`/api/v1/admin/messages/${row.id}`)
      .set(auth())
      .send({ isRead: true, isArchived: true })
      .expect(200);

    const readRes = await request(httpServer(app))
      .get('/api/v1/admin/messages?isRead=true&perPage=50&page=1')
      .set(auth())
      .expect(200);
    expect(readRes).toSatisfyApiSpec();
    expect(
      envelopeData<Msg[]>(readRes).some((m) => m.subject === subject),
    ).toBe(true);

    // It is read now, so the unread filter must exclude it (newest read ⇒ would be page 1 if the
    // filter were ignored — a discriminating absence check).
    expect((await listNewestUnread()).some((m) => m.subject === subject)).toBe(
      false,
    );

    const archivedRes = await request(httpServer(app))
      .get('/api/v1/admin/messages?isArchived=true&perPage=50&page=1')
      .set(auth())
      .expect(200);
    expect(archivedRes).toSatisfyApiSpec();
    expect(
      envelopeData<Msg[]>(archivedRes).some((m) => m.subject === subject),
    ).toBe(true);
  });

  it('paginates the inbox with a contract-valid {data, meta} envelope', async () => {
    const res = await request(httpServer(app))
      .get('/api/v1/admin/messages?perPage=1&page=1')
      .set(auth())
      .expect(200);
    expect(res).toSatisfyApiSpec();
    expect(envelopeData<Msg[]>(res).length).toBeLessThanOrEqual(1);
    expect(pageMeta(res).perPage).toBe(1);
  });

  it('returns one message by id', async () => {
    const subject = subjectFor('by-id');
    const row = await createPersistedMessage(subject);
    const res = await request(httpServer(app))
      .get(`/api/v1/admin/messages/${row.id}`)
      .set(auth())
      .expect(200);
    expect(res).toSatisfyApiSpec();
    expect(envelopeData<Msg>(res)).toMatchObject({ id: row.id, subject });
  });

  it('toggles read/archived state via PATCH', async () => {
    const subject = subjectFor('toggle');
    const row = await createPersistedMessage(subject);

    const read = await request(httpServer(app))
      .patch(`/api/v1/admin/messages/${row.id}`)
      .set(auth())
      .send({ isRead: true, isArchived: true })
      .expect(200);
    expect(read).toSatisfyApiSpec();
    expect(envelopeData<Msg>(read)).toMatchObject({
      isRead: true,
      isArchived: true,
    });

    const unread = await request(httpServer(app))
      .patch(`/api/v1/admin/messages/${row.id}`)
      .set(auth())
      .send({ isRead: false })
      .expect(200);
    expect(unread).toSatisfyApiSpec();
    expect(envelopeData<Msg>(unread)).toMatchObject({
      isRead: false,
      isArchived: true,
    });
  });

  it('rejects an unauthenticated inbox request with a contract-valid 401', async () => {
    const res = await request(httpServer(app))
      .get('/api/v1/admin/messages')
      .expect(401);
    expect(res).toSatisfyApiSpec();
  });

  it('forbids a token lacking messages.* with a contract-valid 403', async () => {
    const roleRes = await request(httpServer(app))
      .post('/api/v1/admin/roles')
      .set(auth())
      .send({ name: `NoMessages ${unique}`, permissions: ['categories.read'] })
      .expect(201);
    const roleId = envelopeData<{ id: string }>(roleRes).id;

    const email = `no-messages-${unique}@example.com`;
    const password = 'change-me-minimum-12';
    await request(httpServer(app))
      .post('/api/v1/admin/users')
      .set(auth())
      .send({ email, password, roleId })
      .expect(201);
    const login = await request(httpServer(app))
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const token = envelopeData<{ accessToken: string }>(login).accessToken;

    const res = await request(httpServer(app))
      .get('/api/v1/admin/messages')
      .set({ Authorization: `Bearer ${token}` })
      .expect(403);
    expect(res).toSatisfyApiSpec();
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  // Intake normalization end-to-end (D10-15, doc 10 §6). The DTO unit spec proves the transform;
  // this proves the whole request pipeline honours it — the pipe validates the trimmed value and
  // the row the dashboard later reads is the trimmed one, not the padded one.
  describe('intake normalization (D10-15)', () => {
    it('persists the four real fields trimmed, and the inbox serves them trimmed', async () => {
      const subject = subjectFor('trim-persist');
      const res = await submitContact({
        name: '   Alex Morgan   ',
        email: '  alex@example.com  ',
        subject: `   ${subject}   `,
        body: '\n  A padded enquiry about a Nuxt build.  \n',
        elapsedMs: 8200,
      }).expect(200);
      expect(res).toSatisfyApiSpec();

      const row = (await listNewestUnread()).find((m) => m.subject === subject);
      expect(row).toBeDefined();
      expect(row?.name).toBe('Alex Morgan');
      expect(row?.email).toBe('alex@example.com');
      expect(row?.subject).toBe(subject);
      expect(row?.body).toBe('A padded enquiry about a Nuxt build.');
    });

    // The correction's point: `@MinLength(1)` alone accepted these and wrote a blank inbox row.
    it.each([['name'], ['subject'], ['body'], ['email']])(
      'rejects a whitespace-only %s with a contract-valid 422',
      async (field) => {
        const subject = subjectFor(`blank-${field}`);
        const res = await submitContact({
          ...validBody(subject),
          [field]: '   ',
        }).expect(422);
        expect(res).toSatisfyApiSpec();
        expect(res.headers['content-type']).toContain(
          'application/problem+json',
        );
      },
    );

    it('persists nothing when a field is whitespace-only', async () => {
      const subject = subjectFor('blank-not-persisted');
      await submitContact({ ...validBody(subject), body: '   ' }).expect(422);
      expect(
        (await listNewestUnread()).some((m) => m.subject === subject),
      ).toBe(false);
    });

    // Previously a false REJECT: `@IsEmail()` saw the surrounding whitespace and 422'd a real address.
    it('accepts a valid email carrying surrounding whitespace and stores it trimmed', async () => {
      const subject = subjectFor('padded-email');
      const res = await submitContact({
        ...validBody(subject),
        email: '  alex@example.com  ',
      }).expect(200);
      expect(res).toSatisfyApiSpec();

      const row = (await listNewestUnread()).find((m) => m.subject === subject);
      expect(row?.email).toBe('alex@example.com');
    });

    it('still rejects a value that exceeds its cap after trimming', async () => {
      const res = await submitContact({
        ...validBody(subjectFor('over-cap')),
        name: `  ${'a'.repeat(201)}  `,
      }).expect(422);
      expect(res).toSatisfyApiSpec();
    });

    // The regression a blanket trim would have caused: `"   "` would become `""` and the honeypot,
    // whose emptiness test is length 0 and nothing else (D02-1), would stop firing.
    it('keeps a whitespace-only honeypot tripping — neutral 200, nothing persisted', async () => {
      const subject = subjectFor('honeypot-whitespace');
      const res = await submitContact({
        ...validBody(subject),
        website: '   ',
      }).expect(200);
      expect(res).toSatisfyApiSpec();
      expect(envelopeData<{ received: boolean }>(res)).toEqual({
        received: true,
      });

      expect(
        (await listNewestUnread()).some((m) => m.subject === subject),
      ).toBe(false);
    });

    it('leaves the time-trap semantics unchanged — sub-threshold still drops as success', async () => {
      const subject = subjectFor('elapsed-unchanged');
      const res = await submitContact({
        ...validBody(subject),
        elapsedMs: 10,
      }).expect(200);
      expect(res).toSatisfyApiSpec();
      expect(envelopeData<{ received: boolean }>(res)).toEqual({
        received: true,
      });

      expect(
        (await listNewestUnread()).some((m) => m.subject === subject),
      ).toBe(false);
    });

    it('persists an accepted submission exactly once', async () => {
      const subject = subjectFor('exactly-once');
      await submitContact(validBody(subject)).expect(200);

      const matches = (await collectUntil([subject])).filter(
        (m) => m.subject === subject,
      );
      expect(matches).toHaveLength(1);
    });
  });

  // Email-or-phone visitor contact (D10-16) through the whole pipeline, plus the database CHECK
  // constraint that backs it independently of this DTO (D09-19).
  describe('contact methods (D10-16)', () => {
    it('accepts a phone-only submission and stores the phone with a null email', async () => {
      const subject = subjectFor('phone-only');
      const body = validBody(subject);
      delete body.email;
      const res = await submitContact({
        ...body,
        phone: '+20 100 278 5408',
      }).expect(200);
      expect(res).toSatisfyApiSpec();

      const row = (await listNewestUnread()).find((m) => m.subject === subject);
      expect(row).toBeDefined();
      expect(row?.email).toBeNull();
      // Normalized to E.164 — the human spacing never reaches storage.
      expect(row?.phone).toBe('+201002785408');
    });

    it('accepts an email-only submission and stores a null phone', async () => {
      const subject = subjectFor('email-only');
      const res = await submitContact(validBody(subject)).expect(200);
      expect(res).toSatisfyApiSpec();

      const row = (await listNewestUnread()).find((m) => m.subject === subject);
      expect(row?.email).toBe('alex@example.com');
      expect(row?.phone).toBeNull();
    });

    it('accepts both and stores both', async () => {
      const subject = subjectFor('both-methods');
      await submitContact({
        ...validBody(subject),
        phone: '+201002785408',
      }).expect(200);

      const row = (await listNewestUnread()).find((m) => m.subject === subject);
      expect(row?.email).toBe('alex@example.com');
      expect(row?.phone).toBe('+201002785408');
    });

    it('rejects a submission with neither method (contract-valid 422)', async () => {
      const body = validBody(subjectFor('no-method'));
      delete body.email;
      const res = await submitContact(body).expect(422);
      expect(res).toSatisfyApiSpec();
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('rejects both-blank-after-trimming and persists nothing', async () => {
      const subject = subjectFor('blank-methods');
      await submitContact({
        ...validBody(subject),
        email: '   ',
        phone: '  ',
      }).expect(422);
      expect(
        (await listNewestUnread()).some((m) => m.subject === subject),
      ).toBe(false);
    });

    // The rule that stops a mistyped address being thrown away because the other method is valid.
    it('rejects a malformed email even when a valid phone is supplied', async () => {
      const res = await submitContact({
        ...validBody(subjectFor('bad-email-good-phone')),
        email: 'not-an-email',
        phone: '+201002785408',
      }).expect(422);
      expect(res).toSatisfyApiSpec();
    });

    it('rejects a malformed phone even when a valid email is supplied', async () => {
      const res = await submitContact({
        ...validBody(subjectFor('good-email-bad-phone')),
        phone: 'not-a-phone',
      }).expect(422);
      expect(res).toSatisfyApiSpec();
    });

    it('rejects a phone missing its leading +', async () => {
      await submitContact({
        ...validBody(subjectFor('phone-no-plus')),
        phone: '201002785408',
      }).expect(422);
    });

    // The database backstop: even bypassing the DTO entirely, an unanswerable row cannot exist.
    it('the database refuses a message with no contact method (D09-19)', async () => {
      const prisma = app.get(PrismaService);
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO contact_messages (id, name, subject, body, updated_at)
           VALUES (gen_random_uuid(), 'Bypass', 'Bypass ${unique}', 'B', now())`,
        ),
      ).rejects.toThrow(/contact_messages_contact_method_present/);
    });

    it('the database refuses whitespace-only contact methods (D09-19)', async () => {
      const prisma = app.get(PrismaService);
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO contact_messages (id, name, email, phone, subject, body, updated_at)
           VALUES (gen_random_uuid(), 'Bypass', '  ', '  ', 'Bypass2 ${unique}', 'B', now())`,
        ),
      ).rejects.toThrow(/contact_messages_contact_method_present/);
    });
  });
});
