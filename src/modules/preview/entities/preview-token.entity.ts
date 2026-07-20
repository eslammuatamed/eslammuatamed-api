import { ApiProperty } from '@nestjs/swagger';

// Mint response for a preview token (D10-11, D19-7). `token` is the stateless HMAC credential;
// `url` is the API-relative consume path the dashboard fetches to render the draft — NOT a
// human-shareable web-page URL, because the API describes only its own routes (constitution rule 1,
// no web origin hard-coded). `expiresAt` bounds the leak window (mint time + 30 min). The envelope
// interceptor wraps this as { data: { token, url, expiresAt } }.
export class PreviewTokenEntity {
  @ApiProperty({
    example: 'MTc1MzAxMjgwMDAwMA.q3n8p0Zx5t2Yc1Rk9f7wLmA6bd4eHsG2uVjOiN0pXyE',
    description:
      'Stateless HMAC preview token. Present it as ?token= on the returned url. Never logged.',
  })
  readonly token!: string;

  @ApiProperty({
    example:
      '/api/v1/preview/articles/2f1c8d9e-4a3b-4c5d-8e6f-7a8b9c0d1e2f?token=MTc1MzAxMjgwMDAwMA.q3n8p0Zx5t2Yc1Rk9f7wLmA6bd4eHsG2uVjOiN0pXyE',
    description:
      'API-relative consume path (/api/v1/preview/{articles|projects}/{id}?token=…) the dashboard ' +
      'fetches to load the draft. Not itself the rendered, shareable preview page (a web concern).',
  })
  readonly url!: string;

  @ApiProperty({
    format: 'date-time',
    description: 'When the token expires (mint time + 30 minutes).',
  })
  readonly expiresAt!: Date;
}
