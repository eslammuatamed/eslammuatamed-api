import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

// Trims surrounding whitespace ahead of validation (D10-15), mirroring the intake DTO's helper in
// `create-contact-message.dto.ts`. Duplicated rather than hoisted to a shared module: two five-line
// decorators are cheaper than a common-validation package this repository does not otherwise have,
// and hoisting it would touch the intake DTO for a reason unrelated to this feature.
// String-only by design — a non-string passes through so the ordinary type error still fires.
const TrimIfString = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

// The reply request body — one field, and that is the security property, not an economy (D02-13).
//
// There is deliberately NO `to`, `cc`, `bcc`, `from` or `replyTo` here. The recipient is resolved
// server-side from the addressed `ContactMessage`, so this endpoint can only ever reach an address
// that already wrote to the platform. Adding a recipient field would turn a reply route into a
// general mail sender behind an admin login, which is the exact risk D02-4 named when it rejected
// this feature; D02-13 reverses that rejection only because the field's absence closes it.
//
// The global pipe runs `whitelist` + `forbidNonWhitelisted`, so a body carrying a recipient-shaped
// property is REJECTED with 422 rather than silently stripped. That is fail-closed behaviour and it
// is pinned by a test — a cast can defeat the typing, so the runtime answer is asserted separately.
export class CreateMessageReplyDto {
  @ApiProperty({
    description:
      'The plain-text reply body. Plain text only — no HTML representation exists (D02-13e).',
    minLength: 1,
    maxLength: 5000,
    example: 'Thanks for reaching out — I can take a look at this next week.',
  })
  @TrimIfString()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  readonly body!: string;
}
