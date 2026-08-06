import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreateContactMessageDto } from './create-contact-message.dto';

// Mirror the global pipe (main.ts): whitelist + forbidNonWhitelisted. `validate` returns the same
// ValidationError[] the pipe turns into a 422, so a non-empty result here == a 422 in production and
// an empty result == the body reaches the service. This is the load-bearing anti-spam guarantee:
// the honeypot/time-trap fields must NOT produce a distinguishable 422 when tripped.
async function validateBody(
  body: Record<string, unknown>,
): Promise<ValidationError[]> {
  const dto = plainToInstance(CreateContactMessageDto, body);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

const validBody = (): Record<string, unknown> => ({
  name: 'Alex Morgan',
  email: 'alex@example.com',
  subject: 'Project inquiry',
  body: 'I would like to discuss a Nuxt build.',
});

/** A body carrying neither contact method, for the pair rule below. */
const withoutContact = (): Record<string, unknown> => {
  const body = validBody();
  delete body.email;
  return body;
};

describe('CreateContactMessageDto validation', () => {
  it('accepts a valid message', async () => {
    expect(await validateBody(validBody())).toHaveLength(0);
  });

  it('does NOT reject a filled honeypot — the trap reaches the service, not a 422', async () => {
    const errors = await validateBody({
      ...validBody(),
      website: 'http://spam.example',
    });
    expect(errors).toHaveLength(0);
  });

  it('does NOT reject a sub-threshold elapsedMs — no distinguishable 422', async () => {
    expect(await validateBody({ ...validBody(), elapsedMs: 10 })).toHaveLength(
      0,
    );
  });

  it('does NOT reject a negative elapsedMs', async () => {
    expect(await validateBody({ ...validBody(), elapsedMs: -1 })).toHaveLength(
      0,
    );
  });

  it('accepts both anti-spam fields together (declared, so whitelist lets them through)', async () => {
    expect(
      await validateBody({ ...validBody(), website: '', elapsedMs: 8200 }),
    ).toHaveLength(0);
  });

  it('rejects a missing required field (→ 422)', async () => {
    const body = validBody();
    delete body.name;
    expect(await validateBody(body)).not.toHaveLength(0);
  });

  it('rejects an invalid email (→ 422)', async () => {
    expect(
      await validateBody({ ...validBody(), email: 'not-an-email' }),
    ).not.toHaveLength(0);
  });

  it('rejects an unknown property under forbidNonWhitelisted (→ 422)', async () => {
    expect(
      await validateBody({ ...validBody(), nope: 'unexpected' }),
    ).not.toHaveLength(0);
  });
});

// Intake normalization (D10-15, doc 10 §6). The four real fields are trimmed BEFORE validation, so
// the trimmed value is what the pipe validates and what the service receives. The two anti-spam
// fields are deliberately excluded: trimming `website` would disarm the honeypot, whose emptiness
// test is length 0 and nothing else (D02-1, doc 19 §6).
describe('CreateContactMessageDto normalization (D10-15)', () => {
  const transform = (body: Record<string, unknown>): CreateContactMessageDto =>
    plainToInstance(CreateContactMessageDto, body);

  describe('trims the four real fields before validation', () => {
    it.each([
      ['name', '  Alex Morgan  ', 'Alex Morgan'],
      ['email', '  alex@example.com  ', 'alex@example.com'],
      ['subject', '\tProject inquiry\n', 'Project inquiry'],
      [
        'body',
        '\n  I would like to discuss a Nuxt build.  \n',
        'I would like to discuss a Nuxt build.',
      ],
    ])('%s', (field, padded, expected) => {
      const dto = transform({
        ...validBody(),
        [field]: padded,
      }) as unknown as Record<string, unknown>;
      expect(dto[field]).toBe(expected);
    });
  });

  it('accepts a padded-but-valid body and every field arrives trimmed', async () => {
    const padded = {
      name: '  Alex Morgan  ',
      email: '  alex@example.com  ',
      subject: '  Project inquiry  ',
      body: '  I would like to discuss a Nuxt build.  ',
    };
    expect(await validateBody(padded)).toHaveLength(0);
    const dto = transform(padded);
    expect(dto.name).toBe('Alex Morgan');
    expect(dto.email).toBe('alex@example.com');
    expect(dto.subject).toBe('Project inquiry');
    expect(dto.body).toBe('I would like to discuss a Nuxt build.');
  });

  // The load-bearing correction: `@MinLength(1)` alone passed "   " and persisted a blank row.
  describe('rejects a value that is empty after trimming (→ 422)', () => {
    it.each([
      ['name', '   '],
      ['subject', '\t\t'],
      ['body', '\n \n'],
      ['email', '   '],
    ])('%s', async (field, whitespaceOnly) => {
      const errors = await validateBody({
        ...validBody(),
        [field]: whitespaceOnly,
      });
      expect(errors).not.toHaveLength(0);
      expect(errors.map((e) => e.property)).toContain(field);
    });
  });

  // A padded email was previously a false REJECT: `@IsEmail()` saw the surrounding whitespace.
  it('accepts a valid email carrying surrounding whitespace (was a 422 before D10-15)', async () => {
    expect(
      await validateBody({ ...validBody(), email: '  alex@example.com  ' }),
    ).toHaveLength(0);
    expect(
      transform({ ...validBody(), email: '  alex@example.com  ' }).email,
    ).toBe('alex@example.com');
  });

  // Trimming must not become a way to smuggle an over-limit value past the cap.
  describe('applies the unchanged maximum lengths AFTER trimming (→ 422)', () => {
    it.each([
      ['name', 200],
      ['subject', 300],
      ['body', 5000],
    ])('%s over %i chars', async (field, max) => {
      const errors = await validateBody({
        ...validBody(),
        [field]: `  ${'a'.repeat(max + 1)}  `,
      });
      expect(errors.map((e) => e.property)).toContain(field);
    });

    it('email over 320 chars', async () => {
      const local = 'a'.repeat(320);
      expect(
        await validateBody({
          ...validBody(),
          email: `  ${local}@example.com  `,
        }),
      ).not.toHaveLength(0);
    });

    it('accepts a padded value whose TRIMMED length is exactly at the cap', async () => {
      const exactly200 = 'a'.repeat(200);
      expect(
        await validateBody({ ...validBody(), name: `   ${exactly200}   ` }),
      ).toHaveLength(0);
    });
  });

  // D10-15 / D02-1: the honeypot and the time-trap are NOT normalized.
  describe('leaves the anti-spam fields untransformed', () => {
    it('does not trim the honeypot — a whitespace-only value survives as-is', () => {
      const dto = transform({ ...validBody(), website: '   ' });
      expect(dto.website).toBe('   ');
    });

    it('keeps a padded honeypot value intact', () => {
      const dto = transform({
        ...validBody(),
        website: '  http://spam.example  ',
      });
      expect(dto.website).toBe('  http://spam.example  ');
    });

    it('still lets a whitespace-only honeypot through validation (no trap-revealing 422)', async () => {
      expect(
        await validateBody({ ...validBody(), website: '   ' }),
      ).toHaveLength(0);
    });

    it('does not transform elapsedMs', () => {
      expect(transform({ ...validBody(), elapsedMs: 8200 }).elapsedMs).toBe(
        8200,
      );
      expect(transform({ ...validBody(), elapsedMs: 10 }).elapsedMs).toBe(10);
      expect(transform({ ...validBody(), elapsedMs: -1 }).elapsedMs).toBe(-1);
    });
  });

  // The transform is string-only: a non-string reaches the validator unchanged so it produces the
  // ordinary type 422 rather than throwing inside the transform.
  it('leaves a non-string value untouched so the type error still fires', async () => {
    const dto = transform({ ...validBody(), name: 42 }) as unknown as Record<
      string,
      unknown
    >;
    expect(dto.name).toBe(42);
    expect(await validateBody({ ...validBody(), name: 42 })).not.toHaveLength(
      0,
    );
  });
});

// The email-or-phone pair rule (D10-16) and E.164 normalization. The invariant is ALSO enforced by
// a database CHECK constraint (D09-19); these tests cover the layer that produces the friendly 422.
describe('CreateContactMessageDto contact methods (D10-16)', () => {
  const transform = (body: Record<string, unknown>): CreateContactMessageDto =>
    plainToInstance(CreateContactMessageDto, body);

  describe('accepts any combination that yields at least one usable method', () => {
    it('email only', async () => {
      expect(await validateBody(validBody())).toHaveLength(0);
    });

    it('phone only', async () => {
      expect(
        await validateBody({ ...withoutContact(), phone: '+201002785408' }),
      ).toHaveLength(0);
    });

    it('both', async () => {
      expect(
        await validateBody({ ...validBody(), phone: '+201002785408' }),
      ).toHaveLength(0);
    });
  });

  describe('rejects a submission with no usable method (→ 422)', () => {
    it('neither field present', async () => {
      expect(await validateBody(withoutContact())).not.toHaveLength(0);
    });

    it('both present but blank after trimming', async () => {
      expect(
        await validateBody({ ...withoutContact(), email: '   ', phone: '  ' }),
      ).not.toHaveLength(0);
    });

    it('both present but empty strings', async () => {
      expect(
        await validateBody({ ...withoutContact(), email: '', phone: '' }),
      ).not.toHaveLength(0);
    });
  });

  // The load-bearing rule: a value the visitor actually typed is judged on its own merits. Accepting
  // the message because the OTHER method is valid would discard the correction they would have made.
  describe('rejects a supplied-but-malformed value even when the other method is valid', () => {
    it('malformed email alongside a valid phone', async () => {
      const errors = await validateBody({
        ...withoutContact(),
        email: 'not-an-email',
        phone: '+201002785408',
      });
      expect(errors.map((e) => e.property)).toContain('email');
    });

    it('malformed phone alongside a valid email', async () => {
      const errors = await validateBody({
        ...validBody(),
        phone: 'not-a-phone',
      });
      expect(errors.map((e) => e.property)).toContain('phone');
    });

    it('phone missing its leading + alongside a valid email', async () => {
      const errors = await validateBody({
        ...validBody(),
        phone: '201002785408',
      });
      expect(errors.map((e) => e.property)).toContain('phone');
    });

    it('phone with a zero country code', async () => {
      expect(
        await validateBody({ ...validBody(), phone: '+0123456789' }),
      ).not.toHaveLength(0);
    });

    it('phone that is too long to be dialable', async () => {
      expect(
        await validateBody({ ...validBody(), phone: '+9661234567890123456' }),
      ).not.toHaveLength(0);
    });
  });

  describe('normalizes a supplied phone to E.164 before validation', () => {
    it.each([
      ['spaces', '+20 100 278 5408'],
      ['dashes', '+20-100-278-5408'],
      ['parentheses', '+20 (100) 278 5408'],
      ['mixed punctuation', ' +20.100.278.5408 '],
    ])('%s', async (_label, input) => {
      const body = { ...withoutContact(), phone: input };
      expect(await validateBody(body)).toHaveLength(0);
      expect(transform(body).phone).toBe('+201002785408');
    });

    it('leaves an already-canonical number untouched', () => {
      expect(
        transform({ ...withoutContact(), phone: '+201002785408' }).phone,
      ).toBe('+201002785408');
    });

    // Shape only — normalization must never repair an invalid number into a valid one.
    it('does not repair a number that is invalid after normalization', async () => {
      expect(
        await validateBody({ ...withoutContact(), phone: '+1 2' }),
      ).not.toHaveLength(0);
    });

    it('leaves a non-string phone alone so the type error still fires', async () => {
      expect(
        await validateBody({ ...withoutContact(), phone: 42 }),
      ).not.toHaveLength(0);
    });
  });

  // A blank optional method is ABSENCE, and absence must reach the service as `undefined` so its
  // `?? null` writes SQL NULL (D10-16 (a) "including blank-after-trim", D09-19 "both nullable").
  // The regression this pins: the pair rule read `''` as absence and skipped validation, but `??`
  // is nullish — not falsy — so the `''` travelled on and was persisted into a nullable column.
  // A stored `''` is not a contact method; it is an unanswerable row the column exists to prevent.
  describe('resolves a blank optional method to absence, not an empty string', () => {
    it.each([
      ['empty email', { email: '', phone: '+201002785408' }, 'email'],
      ['whitespace email', { email: '   ', phone: '+201002785408' }, 'email'],
      ['empty phone', { email: 'alex@example.com', phone: '' }, 'phone'],
      ['whitespace phone', { email: 'alex@example.com', phone: '  ' }, 'phone'],
    ])('%s becomes undefined', (_label, patch, blankField) => {
      const dto = transform({
        ...withoutContact(),
        ...patch,
      }) as unknown as Record<string, unknown>;
      expect(dto[blankField]).toBeUndefined();
      // Never the empty string — that is the exact value that used to be persisted.
      expect(dto[blankField]).not.toBe('');
    });

    it.each([
      ['valid email + blank phone', { email: 'alex@example.com', phone: '' }],
      ['valid phone + blank email', { email: '', phone: '+201002785408' }],
    ])(
      '%s is accepted (the surviving method carries the submission)',
      async (_label, patch) => {
        expect(
          await validateBody({ ...withoutContact(), ...patch }),
        ).toHaveLength(0);
      },
    );
  });

  // The blank guard is keyed on the TRIMMED ORIGINAL, never on the digit-stripped result. These two
  // inputs both strip to `''` while being genuinely supplied — if absence were read off the stripped
  // value they would become silent NULLs instead of the 422 the visitor is owed (D10-16).
  describe('a supplied value that strips to empty stays a 422, never a silent absence', () => {
    it('a non-blank phone with no digits keeps its trimmed original for validation', () => {
      const dto = transform({ ...withoutContact(), phone: ' not-a-phone ' });
      expect(dto.phone).toBe('not-a-phone');
    });

    it('rejects a digitless phone even alongside a valid email', async () => {
      expect(
        await validateBody({
          ...withoutContact(),
          email: 'alex@example.com',
          phone: 'not-a-phone',
        }),
      ).not.toHaveLength(0);
    });

    // Boundary guard for D13-6: the WEB folds Arabic-Indic/Persian digits to ASCII before sending
    // E.164; the API accepts normalized ASCII international values only. Arabic-Indic digits are not
    // ASCII `\d`, so they strip to `''` — they must remain a 422, NOT become a silent NULL. This
    // pins the approved split; it does not change API behaviour.
    it('rejects Arabic-Indic digits rather than treating them as absent', async () => {
      const dto = transform({ ...withoutContact(), phone: '٠١٠٠٢٧٨٥٤٠٨' });
      expect(dto.phone).toBeDefined();
      expect(dto.phone).not.toBe('');
      expect(
        await validateBody({
          ...withoutContact(),
          email: 'alex@example.com',
          phone: '٠١٠٠٢٧٨٥٤٠٨',
        }),
      ).not.toHaveLength(0);
    });
  });

  // The anti-spam layers are untouched by the pair rule.
  it('still lets a filled honeypot through validation with a phone-only body', async () => {
    expect(
      await validateBody({
        ...withoutContact(),
        phone: '+201002785408',
        website: 'http://spam.example',
      }),
    ).toHaveLength(0);
  });

  it('still lets a sub-threshold elapsedMs through with a phone-only body', async () => {
    expect(
      await validateBody({
        ...withoutContact(),
        phone: '+201002785408',
        elapsedMs: 10,
      }),
    ).toHaveLength(0);
  });
});
