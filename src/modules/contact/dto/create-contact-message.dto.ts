import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Trims surrounding whitespace ahead of validation (D10-15). String-only by design: a non-string
// passes through untouched so the ordinary type error still fires instead of throwing in here.
// Applied to the four REAL fields only — never to `website` or `elapsedMs` (see below).
const TrimIfString = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

// Public contact intake body (FR-PUB-050/051/052). The four real fields are trimmed (D10-15),
// length-capped and whitelisted; the two anti-spam fields are declared but permissive by design
// (see below).
//
// Normalization order matters: `@Transform` runs during plainToInstance, so the global pipe
// (`transform: true`, main.ts) validates the TRIMMED value and the service persists it. That is
// what makes a whitespace-only field a 422 rather than a blank inbox row, and what makes the caps
// below describe the real message rather than its padding (doc 10 §6, D10-15).
export class CreateContactMessageDto {
  @ApiProperty({
    example: 'Alex Morgan',
    minLength: 1,
    maxLength: 200,
    description:
      'Trimmed of surrounding whitespace before validation; a value empty after trimming is rejected (D10-15).',
  })
  @TrimIfString()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  readonly name!: string;

  // No `minLength`: the binding constraint is the email format itself, so exporting a redundant 1
  // would document a rule that is not the one doing the rejecting (D10-15).
  @ApiProperty({
    example: 'alex@example.com',
    maxLength: 320,
    description:
      'Trimmed of surrounding whitespace before validation, so a padded but otherwise valid address is accepted (D10-15).',
  })
  @TrimIfString()
  @IsEmail()
  @MaxLength(320)
  readonly email!: string;

  @ApiProperty({
    example: 'Project inquiry',
    minLength: 1,
    maxLength: 300,
    description:
      'Trimmed of surrounding whitespace before validation; a value empty after trimming is rejected (D10-15).',
  })
  @TrimIfString()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  readonly subject!: string;

  @ApiProperty({
    example: "I'd like to discuss a Nuxt build.",
    minLength: 1,
    maxLength: 5000,
    description:
      'Trimmed of surrounding whitespace before validation; a value empty after trimming is rejected (D10-15).',
  })
  @TrimIfString()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  readonly body!: string;

  // Anti-spam honeypot (D02-1): a real form keeps this hidden and empty. It MUST be declared so the
  // global pipe's `forbidNonWhitelisted` accepts it, yet it carries NO `@MaxLength` — a bot filling
  // it with any length must reach the service and be dropped-as-success, never rejected by the pipe
  // with a distinguishable 422 that would leak the trap (the service, not the pipe, drops it).
  //
  // Deliberately NOT trimmed (D10-15). The trap's emptiness test is "length 0, nothing else"
  // (anti-spam.ts, doc 19 §6), so a whitespace-only value is a bot signal — trimming it here would
  // turn `"   "` into `""` and silently disarm the layer.
  @ApiPropertyOptional({
    description:
      'Anti-spam honeypot — leave empty. Any value flags the submission as spam. Never trimmed, never persisted.',
    example: '',
  })
  @IsOptional()
  @IsString()
  readonly website?: string;

  // Anti-spam time-trap (D02-1, D05-4): client-computed milliseconds elapsed between form render and
  // submit (an elapsed duration, not an absolute timestamp). Declared for the same whitelist reason,
  // and permissive by design — NO `@Min`, so a sub-threshold or negative value reaches the service
  // and is dropped-as-success rather than rejected with a trap-revealing 422.
  @ApiPropertyOptional({
    description:
      'Anti-spam time-trap — milliseconds between form render and submit. Below ~3000 flags the ' +
      'submission as spam. Never persisted.',
    example: 8200,
  })
  @IsOptional()
  @IsNumber()
  readonly elapsedMs?: number;
}
