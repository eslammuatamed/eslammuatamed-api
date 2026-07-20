import { ApiProperty } from '@nestjs/swagger';

// Mint response for a preview token (D10-11 v1.4.1, D19-7). `token` is the stateless HMAC credential;
// `url` is the ABSOLUTE rendered-Web preview link (${PUBLIC_WEB_URL}/preview/{articles|projects}/{id}
// ?token=…) the dashboard shares verbatim — the API signs, the Web renders the page (which then calls
// the consuming GET /api/v1/preview/… API route to load the draft). `expiresAt` bounds the leak window
// (mint time + 30 min). The envelope interceptor wraps this as { data: { token, url, expiresAt } }.
export class PreviewTokenEntity {
  @ApiProperty({
    example: 'MTc1MzAxMjgwMDAwMA.q3n8p0Zx5t2Yc1Rk9f7wLmA6bd4eHsG2uVjOiN0pXyE',
    description:
      'Stateless HMAC preview token. Also embedded as ?token= in the returned url. Never logged.',
  })
  readonly token!: string;

  @ApiProperty({
    example:
      'https://eslammuatamed.com/preview/articles/2f1c8d9e-4a3b-4c5d-8e6f-7a8b9c0d1e2f?token=MTc1MzAxMjgwMDAwMA.q3n8p0Zx5t2Yc1Rk9f7wLmA6bd4eHsG2uVjOiN0pXyE',
    description:
      'Absolute rendered-Web preview link (${PUBLIC_WEB_URL}/preview/{articles|projects}/{id}?token=…) ' +
      'the dashboard shares verbatim as a clean-browser link. The Web page renders the draft by calling ' +
      'the consuming GET /api/v1/preview/… API route (D10-11 v1.4.1: the API signs, the Web renders).',
  })
  readonly url!: string;

  @ApiProperty({
    format: 'date-time',
    description: 'When the token expires (mint time + 30 minutes).',
  })
  readonly expiresAt!: Date;
}
