import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

// Trims surrounding whitespace ahead of validation (D10-15). String-only by design: a non-string
// passes through untouched so the ordinary type error still fires instead of throwing in here.
// Applied to the four REAL fields only — never to `website` or `elapsedMs` (see below).
const TrimIfString = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

// The ONE normalization boundary for the two OPTIONAL visitor contact methods (D10-16 (a), D09-19).
// `isSupplied` below already defines what the pair rule — and the database CHECK constraint — count
// as "a contact method". These transforms make PERSISTENCE agree with that same predicate by
// resolving anything it rejects to `undefined`, which the service maps to SQL NULL with its existing
// `?? null`. Previously a blank string satisfied neither side: the pair rule read it as absence and
// skipped validation, while `??` (nullish, not falsy) passed the `''` straight through to a nullable
// column. An empty string is not a contact method, and the column's whole point (D09-19) is that an
// absent method is NULL.
//
// The guard is keyed on the TRIMMED ORIGINAL — never on a post-normalization result. That
// distinction is load-bearing: see NormalizePhoneIfString below.
const absentIfBlank = (trimmed: string): string | undefined =>
  trimmed === '' ? undefined : trimmed;

// Trims an optional string and resolves blank-after-trim to absence (see above). Distinct from
// `TrimIfString`, which the REQUIRED fields keep: there, `''` must survive so `@MinLength(1)` is the
// rule that rejects it.
const TrimOptionalIfString = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? absentIfBlank(value.trim()) : value,
  );

// Collapses a human-entered number to canonical E.164 (D10-16): strip every character that is not a
// digit or the leading `+`, so `"+20 100 278 5408"`, `"+20-100-278-5408"` and `"+20 (100) 2785408"`
// all reduce to `"+201002785408"`. The API stores an INTERNATIONAL number, never a display-formatted
// one — grouping is a rendering convention and storing it would make two identical numbers unequal.
//
// This normalizes SHAPE only; it never repairs a number, and — critically — it never makes a
// supplied value look UNSUPPLIED. A value like `"not-a-phone"` contains no digits and would collapse
// to `""`, which the pair rule would then read as "no phone given" and wave through on the strength
// of a valid email. That is the silent discard D10-16 forbids: the visitor typed something and is
// entitled to be told it is wrong. So when normalization empties a non-blank input, the trimmed
// ORIGINAL is returned instead, and it goes on to fail `@IsPhoneNumber` as a 422 of its own.
//
// Hence the blank check happens FIRST, against the trimmed original, and the stripped result is
// never consulted for emptiness. Two distinct inputs strip to `''` while being genuinely supplied:
// `"not-a-phone"` (no digits at all) and `"٠١٠٠٢٧٨٥٤٠٨"` (Arabic-Indic digits, which are not ASCII
// `\d`). Reading absence off the stripped value would turn both into a silent NULL — discarding a
// correction the visitor was entitled to make, and quietly relocating the digit-folding boundary
// that the Web owns and the API does not (D13-6). Both must stay 422s.
const NormalizePhoneIfString = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    if (absentIfBlank(trimmed) === undefined) {
      return undefined;
    }
    const compact = trimmed.replace(/[^\d+]/g, '');
    const normalized = compact.startsWith('+')
      ? `+${compact.slice(1).replace(/\+/g, '')}`
      : compact;
    return normalized === '' ? trimmed : normalized;
  });

// Treats an absent, non-string or blank-after-normalization value as "not supplied", so the pair
// rule below sees the same emptiness the database CHECK constraint does (D09-19).
function isSupplied(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

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

  // Optional as of D10-16 — but only in the sense that PHONE may stand in for it. Exactly one of
  // the pair is required, enforced here and, independently, by the database CHECK constraint
  // (D09-19).
  //
  // `@ValidateIf` and NOT `@IsOptional()`: `@IsOptional()` skips every other validator whenever the
  // value is null/undefined, which would silently defeat the pair rule below.
  //
  // The pair rule lives on `email` so the "no contact method" 422 names the first field of the pair
  // rather than the second. It fires when the visitor supplied an email (validate what they typed)
  // OR supplied no usable phone (something must be here). A supplied-but-malformed address is
  // therefore a 422 in its own right, never waved through because a phone happens to be valid —
  // silently discarding it would throw away the correction they would have made, on the platform's
  // single conversion point (D10-16).
  //
  // No `minLength`: the binding constraint is the email format itself, so exporting a redundant 1
  // would document a rule that is not the one doing the rejecting (D10-15).
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'alex@example.com',
    maxLength: 320,
    description:
      'Optional. Trimmed before validation. At least one of `email` or `phone` is required; a supplied but malformed value is rejected rather than ignored (D10-16). `null` states "not supplied" explicitly — `isSupplied()` already treats it as empty, so a phone-only visitor may send it (D10-25).',
  })
  @TrimOptionalIfString()
  @ValidateIf(
    (dto: { phone?: unknown }, value: unknown) =>
      isSupplied(value) || !isSupplied(dto.phone),
  )
  @IsEmail()
  @MaxLength(320)
  readonly email?: string | null;

  // The other half of the pair, transported and stored in E.164 only (D10-16). Validated only when
  // the visitor actually supplied something — the "neither method" case is reported on `email`
  // above, so a blank form yields one clear error rather than two competing ones.
  //
  // `@IsPhoneNumber()` with no region argument requires a full international number and comes from
  // the already-installed `class-validator`, so no dependency is added (D10-16, D13-6).
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '+201002785408',
    description:
      'Optional. E.164 international format — the API stores an international number, never a display-formatted one; human spacing is normalized away before validation. At least one of `email` or `phone` is required (D10-16). `null` states "not supplied" explicitly, which is what the Web\'s `normalizePhone()` returns for an empty entry (D10-25).',
  })
  @NormalizePhoneIfString()
  @ValidateIf((_, value: unknown) => isSupplied(value))
  @IsPhoneNumber()
  readonly phone?: string | null;

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
