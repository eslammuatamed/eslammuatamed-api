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
