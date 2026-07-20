import { ApiProperty } from '@nestjs/swagger';

// The resolve response payload (D10-7): the section-relative destination path the front-end issues
// its 301 to. The envelope interceptor wraps this as { data: { toPath } }.
export class RedirectResolveEntity {
  @ApiProperty({
    example: '/blog/new-slug',
    description: 'Section-relative destination path for the matched redirect.',
  })
  readonly toPath!: string;
}
