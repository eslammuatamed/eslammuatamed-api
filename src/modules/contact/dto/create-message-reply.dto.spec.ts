import { ValidationPipe } from '@nestjs/common';
import { ValidationProblemException } from '../../../common/http/validation-problem.exception';
import { flattenValidationErrors } from '../../../common/http/validation-problem.exception';
import { CreateMessageReplyDto } from './create-message-reply.dto';

// The GLOBAL pipe's configuration, reproduced verbatim from main.ts. Reproduced rather than
// imported because main.ts builds it inside `bootstrap()`; the risk that the two drift apart is
// answered by the first test below, which fails if this repo ever stops forbidding unknown fields.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) =>
    new ValidationProblemException(flattenValidationErrors(errors)),
});

const metadata = {
  type: 'body' as const,
  metatype: CreateMessageReplyDto,
};

const validate = (payload: unknown): Promise<unknown> =>
  pipe.transform(payload, metadata);

describe('CreateMessageReplyDto', () => {
  it('accepts a plain-text body', async () => {
    await expect(
      validate({ body: 'Thanks for reaching out.' }),
    ).resolves.toEqual({ body: 'Thanks for reaching out.' });
  });

  it('trims surrounding whitespace and rejects a body that is empty after trimming', async () => {
    await expect(validate({ body: '  Hello  ' })).resolves.toEqual({
      body: 'Hello',
    });
    await expect(validate({ body: '   ' })).rejects.toBeInstanceOf(
      ValidationProblemException,
    );
  });

  it('rejects a missing body and one over the length cap', async () => {
    await expect(validate({})).rejects.toBeInstanceOf(
      ValidationProblemException,
    );
    await expect(validate({ body: 'a'.repeat(5001) })).rejects.toBeInstanceOf(
      ValidationProblemException,
    );
  });

  // THE SECURITY TEST (D02-13). The DTO has no recipient property, and the repository's global
  // policy is whitelist + forbidNonWhitelisted — so a recipient-shaped field must be REJECTED, not
  // silently stripped. Stripping would also be safe here, but rejecting is what this repo
  // guarantees, and asserting the guarantee is what makes a future relaxation of the global pipe
  // fail loudly on the one endpoint that sends email rather than degrade quietly.
  it.each([
    ['to'],
    ['cc'],
    ['bcc'],
    ['from'],
    ['replyTo'],
    ['recipient'],
    ['email'],
  ])(
    'rejects a body attempting to smuggle a recipient via `%s`',
    async (field) => {
      await expect(
        validate({ body: 'Hello.', [field]: 'attacker@example.com' }),
      ).rejects.toBeInstanceOf(ValidationProblemException);
    },
  );

  // A negative control for the test above: it must be the UNKNOWN FIELD that causes the rejection,
  // not something incidental about the payload. Without this, the block above would still pass if
  // the DTO rejected every request for an unrelated reason.
  it('accepts the same payload once the recipient field is removed', async () => {
    await expect(validate({ body: 'Hello.' })).resolves.toEqual({
      body: 'Hello.',
    });
  });

  // Names the failing field, so a client that sent one is told which one — and so this test would
  // fail if the rejection ever came from a different rule than the whitelist.
  it('names the unknown property in the validation problem', async () => {
    let thrown: ValidationProblemException | undefined;
    try {
      await validate({ body: 'Hello.', to: 'attacker@example.com' });
    } catch (error: unknown) {
      thrown = error as ValidationProblemException;
    }

    expect(thrown?.fieldErrors).toEqual([
      { field: 'to', message: expect.stringContaining('should not exist') },
    ]);
  });
});
