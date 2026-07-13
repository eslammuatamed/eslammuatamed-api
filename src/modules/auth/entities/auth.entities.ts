import { ApiProperty } from '@nestjs/swagger';

// The authenticated user's role, resolved by name (roles are data — D09-7). The web uses it
// for display only; authorization is always enforced server-side per request (D19-8).
export class AuthUserRoleEntity {
  @ApiProperty({
    example: '018f9d3c-1a2b-7c3d-8e4f-5a6b7c8d9e0f',
    format: 'uuid',
  })
  readonly id!: string;

  @ApiProperty({ example: 'OWNER' })
  readonly name!: string;
}

export class AuthUserEntity {
  @ApiProperty({
    example: '018f9d3c-1a2b-7c3d-8e4f-5a6b7c8d9e0f',
    format: 'uuid',
  })
  readonly id!: string;

  @ApiProperty({ example: 'owner@example.com', format: 'email' })
  readonly email!: string;

  @ApiProperty({ type: AuthUserRoleEntity })
  readonly role!: AuthUserRoleEntity;
}

export class LoginResponse {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      '15-minute access token; the refresh token is set as an httpOnly cookie.',
  })
  readonly accessToken!: string;

  @ApiProperty({ type: AuthUserEntity })
  readonly user!: AuthUserEntity;
}

export class RefreshResponse {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  readonly accessToken!: string;
}

export class LogoutResponse {
  @ApiProperty({ example: true })
  readonly success!: boolean;
}
