import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope';
import { ApiProblemResponse } from '../../common/swagger/api-problem-response';
import { THROTTLE_TIERS } from '../../common/throttling/throttle-tiers';
import { AppConfigService } from '../../config/app-config.service';
import { AuthService } from './auth.service';
import {
  clearRefreshCookieOptions,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from './cookies';
import { LoginDto } from './dto/login.dto';
import {
  LoginResponse,
  LogoutResponse,
  RefreshResponse,
} from './entities/auth.entities';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: THROTTLE_TIERS.login })
  @ApiOperation({
    summary:
      'Authenticate; sets the refresh cookie and returns an access token.',
  })
  @ApiOkEnvelope(LoginResponse)
  @ApiProblemResponse(HttpStatus.UNAUTHORIZED, 'Invalid credentials.')
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Malformed login payload.',
  )
  @ApiProblemResponse(
    HttpStatus.TOO_MANY_REQUESTS,
    'Login rate limit exceeded (5 / 15 min).',
  )
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const session = await this.authService.login(dto.email, dto.password);
    res.cookie(
      REFRESH_COOKIE_NAME,
      session.refreshToken,
      refreshCookieOptions(this.config, session.refreshExpiresAt),
    );
    return { accessToken: session.accessToken, user: session.user };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: THROTTLE_TIERS.refresh })
  @ApiOperation({
    summary: 'Rotate the refresh token and issue a new access token.',
  })
  @ApiOkEnvelope(RefreshResponse)
  @ApiProblemResponse(
    HttpStatus.UNAUTHORIZED,
    'Missing, invalid, expired, or revoked refresh token.',
  )
  @ApiProblemResponse(
    HttpStatus.TOO_MANY_REQUESTS,
    'Refresh rate limit exceeded (30 / hour).',
  )
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponse> {
    const presented = readRefreshCookie(req);
    const session = await this.authService.refresh(presented);
    res.cookie(
      REFRESH_COOKIE_NAME,
      session.refreshToken,
      refreshCookieOptions(this.config, session.refreshExpiresAt),
    );
    return { accessToken: session.accessToken };
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke the refresh-token family and clear the cookie.',
  })
  @ApiOkEnvelope(LogoutResponse)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponse> {
    await this.authService.logout(readRefreshCookie(req));
    res.clearCookie(
      REFRESH_COOKIE_NAME,
      clearRefreshCookieOptions(this.config),
    );
    return { success: true };
  }
}

function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_COOKIE_NAME];
}
