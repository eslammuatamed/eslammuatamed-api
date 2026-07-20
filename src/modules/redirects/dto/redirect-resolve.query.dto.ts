import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { LocaleQueryDto } from '../../../common/dto/locale-query.dto';

// Public resolve query (D10-7): the validated ?locale= (inherited from LocaleQueryDto, default
// 'en') plus the section-relative website ?path=. Membership of the locale in the enabled set is
// checked in the service (LocalesService.assertEnabled) — no silent cross-locale fallback (D10-6).
export class RedirectResolveQueryDto extends LocaleQueryDto {
  @ApiProperty({
    example: '/blog/old-slug',
    description:
      'Section-relative website path to resolve (the front-end strips the /ar prefix). ' +
      'Grammar: /blog/{slug} → article, /projects/{slug} → project.',
  })
  @IsString()
  @MaxLength(2048)
  readonly path!: string;
}
