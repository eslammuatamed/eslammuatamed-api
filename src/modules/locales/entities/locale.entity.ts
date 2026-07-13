import { ApiProperty } from '@nestjs/swagger';

export class LocaleEntity {
  @ApiProperty({
    example: 'en',
    description: 'Two-letter locale code (primary key).',
  })
  readonly code!: string;

  @ApiProperty({ example: 'English' })
  readonly name!: string;

  @ApiProperty({
    example: 'العربية',
    description: 'Endonym shown in the locale switcher.',
  })
  readonly nativeName!: string;

  @ApiProperty({
    example: 'ltr',
    enum: ['ltr', 'rtl'],
    description: 'Text direction as data (D09-5).',
  })
  readonly dir!: string;
}
