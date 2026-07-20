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
