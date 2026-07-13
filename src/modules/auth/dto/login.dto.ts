import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'owner@example.com', format: 'email' })
  @IsEmail()
  readonly email!: string;

  // No length rule here: a wrong (possibly short) password must fail authentication with a
  // 401, not a 422 that would leak password-policy details to an attacker.
  @ApiProperty({ example: 'change-me-minimum-12-chars', minLength: 1 })
  @IsString()
  @IsNotEmpty()
  readonly password!: string;
}
