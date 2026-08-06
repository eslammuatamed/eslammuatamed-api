import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { LocaleQueryDto } from '../../../common/dto/locale-query.dto';

// Preview consume query: the validated ?locale (inherited from LocaleQueryDto, default 'en') plus
// the ?token credential. `token` is DECLARED so the global forbidNonWhitelisted pipe accepts it, but
// kept PERMISSIVE (@IsOptional, no @MaxLength) on purpose — an absent / malformed / garbage token
// must NOT be rejected with a distinguishable 422. It reaches the controller, PreviewTokenService
// .verify returns false, and the route 404s (draft invisibility, FR-PUB-046): a bad token is
// indistinguishable from a missing draft, and never 401/403.
export class PreviewConsumeQueryDto extends LocaleQueryDto {
  @ApiPropertyOptional({
    description:
      'Preview token minted via POST /admin/{articles|projects}/{id}/preview-token. A missing, ' +
      'expired, tampered, or wrong-type token yields 404 (never 401/403), so an unauthorized ' +
      'caller cannot tell a draft exists.',
  })
  @IsOptional()
  @IsString()
  readonly token?: string;
}
