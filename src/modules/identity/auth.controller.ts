import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService, IssuedTokens } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { TenantDiscoverDto, TenantLoginDto } from './dto/tenant-login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from '../../common/decorators';
import { ttlToMs } from '../../common/ttl';

type CookieRequest = Request & { cookies?: Record<string, string> };

@ApiTags('auth')
@Controller()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('platform/auth/login')
  async loginPlatform(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.loginPlatform(dto);
    return this.respondWithTokens(res, tokens);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('tenant/auth/discover')
  discoverTenant(@Body() dto: TenantDiscoverDto) {
    return this.authService.discoverTenantOrganizations(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('tenant/auth/login')
  async loginTenant(
    @Body() dto: TenantLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.loginTenant(dto);
    return this.respondWithTokens(res, tokens);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('auth/refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieName =
      this.config.get<string>('app.cookie.refreshName') ?? 'kv_refresh';
    const refreshToken = dto.refreshToken || req.cookies?.[cookieName];
    const tokens = await this.authService.refresh(refreshToken);
    return this.respondWithTokens(res, tokens);
  }

  @Public()
  @HttpCode(204)
  @Post('auth/logout')
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieName =
      this.config.get<string>('app.cookie.refreshName') ?? 'kv_refresh';
    const refreshToken = dto.refreshToken || req.cookies?.[cookieName];
    await this.authService.revokeRefreshToken(refreshToken);
    this.clearRefreshCookie(res);
  }

  private respondWithTokens(res: Response, tokens: IssuedTokens) {
    this.setRefreshCookie(res, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      tokenType: tokens.tokenType,
      user: tokens.user,
    };
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    const name =
      this.config.get<string>('app.cookie.refreshName') ?? 'kv_refresh';
    const secure = this.config.get<boolean>('app.cookie.secure') ?? false;
    const sameSite =
      this.config.get<'lax' | 'strict' | 'none'>('app.cookie.sameSite') ??
      'lax';
    const refreshTtl = this.config.get<string>('app.jwt.refreshTtl') ?? '7d';
    res.cookie(name, refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      maxAge: ttlToMs(refreshTtl),
    });
  }

  private clearRefreshCookie(res: Response) {
    const name =
      this.config.get<string>('app.cookie.refreshName') ?? 'kv_refresh';
    const secure = this.config.get<boolean>('app.cookie.secure') ?? false;
    const sameSite =
      this.config.get<'lax' | 'strict' | 'none'>('app.cookie.sameSite') ??
      'lax';
    res.clearCookie(name, { httpOnly: true, secure, sameSite, path: '/' });
  }
}
