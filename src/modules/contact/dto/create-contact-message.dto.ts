import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Public contact intake body (FR-PUB-050/051/052). The four real fields are length-capped and
// whitelisted; the two anti-spam fields are declared but permissive by design (see below).
export class CreateContactMessageDto {
  @ApiProperty({ example: 'Alex Morgan', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  readonly name!: string;

  @ApiProperty({ example: 'alex@example.com', maxLength: 320 })
  @IsEmail()
  @MaxLength(320)
  readonly email!: string;

  @ApiProperty({ example: 'Project inquiry', maxLength: 300 })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  readonly subject!: string;

  @ApiProperty({
    example: "I'd like to discuss a Nuxt build.",
    maxLength: 5000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  readonly body!: string;

  // Anti-spam honeypot (D02-1): a real form keeps this hidden and empty. It MUST be declared so the
  // global pipe's `forbidNonWhitelisted` accepts it, yet it carries NO `@MaxLength` — a bot filling
  // it with any length must reach the service and be dropped-as-success, never rejected by the pipe
  // with a distinguishable 422 that would leak the trap (the service, not the pipe, drops it).
  @ApiPropertyOptional({
    description:
      'Anti-spam honeypot — leave empty. Any value flags the submission as spam. Never persisted.',
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
