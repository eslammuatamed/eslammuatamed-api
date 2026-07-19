import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

const LOCALE_PATTERN = /^[a-z]{2}$/;
const ALT_MAX_LENGTH = 300;

// Per-locale alt update for an image (doc 07 §4, D10-10). `alt` distinguishes a real value —
// including "" (intentionally decorative) — from `null` (remove this locale's alt → "missing" in
// the descriptor). Both are explicit; there is never a silent cross-locale fallback. `alt` is
// required in the body so the caller always states intent (a string, "", or null).
export class UpdateMediaAltDto {
  @ApiProperty({
    example: 'en',
    description: 'Two-letter locale; must be enabled.',
  })
  @Matches(LOCALE_PATTERN, {
    message: 'locale must be a two-letter lowercase code.',
  })
  readonly locale!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'A laptop on a wooden desk',
    description:
      '"" = intentionally decorative; null removes the alt for this locale.',
  })
  @ValidateIf((dto: UpdateMediaAltDto) => dto.alt !== null)
  @IsString()
  @MaxLength(ALT_MAX_LENGTH)
  readonly alt!: string | null;
}
