import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { AppConfigService } from '../../config/app-config.service';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './hashing/password.service';
import { RefreshTokenService } from './tokens/refresh-token.service';

@Module({
  imports: [
    UsersModule,
    // Registered global (current NestJS Security→Authentication guidance, D00-6) so the
    // default-deny JwtAuthGuard in common/ can inject JwtService to verify access tokens. The
    // secret and TTL come from validated config, never process.env (constitution rule 5).
    JwtModule.registerAsync({
      global: true,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): JwtModuleOptions => ({
        secret: config.auth.jwtAccessSecret,
        // JWT_ACCESS_TTL is env-validated against /^\d+(ms|s|m|h|d)$/; @types/jsonwebtoken
        // narrows expiresIn to a branded ms duration the class-validator schema can't express.
        // The algorithm is pinned to HS256 (doc 19 §2): the guard only accepts HS256, so an
        // attacker cannot downgrade to `alg: none` or swap algorithms.
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.auth
            .jwtAccessTtl as `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, RefreshTokenService],
  // PasswordService is exported so the access-control module can hash new operator passwords
  // (argon2id, D19-1) without duplicating the hashing policy.
  exports: [PasswordService],
})
export class AuthModule {}
