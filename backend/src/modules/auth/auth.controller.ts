import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuthService } from './auth.service';
import { LocalLoginDto } from './dto/login.dto';
import { LocalAuthProvider } from './providers/local-auth.provider';
import { EntraAuthProvider } from './providers/entra-auth.provider';

const REFRESH_COOKIE = 'dgs_refresh_token';
const ENTRA_STATE_COOKIE = 'dgs_entra_state';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly localAuthProvider: LocalAuthProvider,
    private readonly entraAuthProvider: EntraAuthProvider,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('config')
  getConfig() {
    return { ssoEnabled: this.entraAuthProvider.isConfigured() };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('local/login')
  @HttpCode(200)
  async localLogin(@Body() dto: LocalLoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.localAuthProvider.validateCredentials(dto.email, dto.password);
    return this.completeLogin(user.id, res);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('entra/login')
  async entraLogin(@Res() res: Response) {
    if (!this.entraAuthProvider.isConfigured()) {
      throw new UnauthorizedException('Entra ID SSO is not configured on this instance');
    }
    const state = this.entraAuthProvider.generateState();
    res.cookie(ENTRA_STATE_COOKIE, state, {
      httpOnly: true,
      secure: this.isProd(),
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
    });
    const url = await this.entraAuthProvider.getAuthorizationUrl(state);
    res.redirect(url);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('entra/callback')
  async entraCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const expectedState = req.cookies?.[ENTRA_STATE_COOKIE];
    res.clearCookie(ENTRA_STATE_COOKIE);
    // This endpoint is a full browser navigation (the redirect Microsoft
    // sends back), not an XHR/fetch call - so unlike localLogin it cannot
    // just return JSON. It sets the refresh-token cookie and redirects into
    // the frontend app, which picks up the session on mount via its normal
    // POST /auth/refresh bootstrap call (see AuthProvider.bootstrap).
    const frontendOrigin = this.config.get<string>('FRONTEND_ORIGIN', 'http://localhost:3000');
    try {
      const user = await this.entraAuthProvider.handleCallback(code, state, expectedState);
      await this.setSessionCookie(user.id, res);
      res.redirect(`${frontendOrigin}/dashboards`);
    } catch {
      res.redirect(`${frontendOrigin}/login?error=sso_failed`);
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) {
      throw new UnauthorizedException('No refresh token provided');
    }
    const tokens = await this.authService.refresh(raw);
    this.setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (raw) {
      await this.authService.logout(raw);
    }
    res.clearCookie(REFRESH_COOKIE);
    return { success: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  private async setSessionCookie(userId: string, res: Response) {
    const fullUser = await this.authService.getUserOrThrow(userId);
    const tokens = await this.authService.issueTokensForUser(fullUser);
    this.setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
    return tokens;
  }

  private async completeLogin(userId: string, res: Response) {
    const tokens = await this.setSessionCookie(userId, res);
    const user = await this.authService.loadPublicUser(userId);
    return { accessToken: tokens.accessToken, user };
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.isProd(),
      sameSite: 'lax',
      expires: expiresAt,
      path: '/api/auth',
    });
  }

  private isProd(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }
}
