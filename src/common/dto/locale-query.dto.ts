import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

// Public reads take an explicit ?locale= (D10-6). Format is validated here; membership in
// the set of *enabled* locales is checked in the service against LocalesService (no silent
// cross-locale fallback — a missing translation stays missing).
export class LocaleQueryDto {
  @ApiPropertyOptional({
    default: 'en',
    example: 'ar',
    description: 'Two-letter locale code, validated against enabled locales.',
  })
  @IsOptional()
  @Matches(/^[a-z]{2}$/, {
    message: 'locale must be a two-letter lowercase code.',
  })
  readonly locale: string = 'en';
}
