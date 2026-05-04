import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RegisterResponse, AuthUser, RefreshResponse } from '@klar/shared';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { OidcService } from '../oidc/oidc.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

interface LoginBody {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface ResendBody {
  email: string;
}

interface HandoverBody {
  code: string;
}

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oidcService: OidcService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: FastifyRequest,
  ): Promise<RegisterResponse> {
    return this.authService.register(dto, {
      ip: req.ip,
      headers: req.headers as Record<string, string | string[] | undefined>,
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() body: LoginBody,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ accessToken: string; user: AuthUser } | { requiresTotp: true; tempToken: string }> {
    const validatedUser = await this.authService.validateLocalUser(body.email, body.password);
    const result = await this.authService.login(validatedUser, { rememberMe: body.rememberMe }, {
      ip: req.ip,
      headers: req.headers as Record<string, string | string[] | undefined>,
    });

    if ('requiresTotp' in result && result.requiresTotp) {
      return { requiresTotp: true, tempToken: result.tempToken };
    }

    const tokenSet = result as { accessToken: string; refreshToken: string; refreshExpiresIn: number; user: AuthUser };
    void reply.setCookie('refresh_token', tokenSet.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: tokenSet.refreshExpiresIn,
    });

    return { accessToken: tokenSet.accessToken, user: tokenSet.user };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async logout(
    @CurrentUser() payload: JwtPayload,
    @Req() req: FastifyRequest & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const raw = req.cookies?.['refresh_token'];
    if (raw) {
      await this.authService.logout(raw, payload.sub);
    }
    void reply.clearCookie('refresh_token', { path: '/api/v1/auth' });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  async refresh(
    @Req() req: FastifyRequest & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<RefreshResponse> {
    const raw = req.cookies?.['refresh_token'];
    if (!raw) {
      throw new BadRequestException('Kein Refresh-Token vorhanden');
    }

    const { accessToken, user, refreshToken, refreshExpiresIn } =
      await this.authService.refresh(raw, {
        ip: req.ip,
        headers: req.headers as Record<string, string | string[] | undefined>,
      });

    void reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: refreshExpiresIn,
    });

    return { accessToken, user };
  }

  @Public()
  @Get('verify-email')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyEmail(
    @Query('token') token: string,
  ): Promise<{ message: string }> {
    if (!token) {
      throw new BadRequestException('Token fehlt');
    }
    await this.authService.verifyEmail(token);
    return { message: 'E-Mail-Adresse erfolgreich bestätigt.' };
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 2, ttl: 300000 } })
  async resendVerification(@Body() body: ResendBody): Promise<{ message: string }> {
    await this.authService.resendVerification(body.email);
    return { message: 'Falls eine passende E-Mail-Adresse existiert, wurde eine neue E-Mail gesendet.' };
  }

  // ── OIDC endpoints ────────────────────────────────────────────────────────

  /** Returns whether OIDC is enabled and the display name. Used by the login page. */
  @Public()
  @Get('oidc/config')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  getOidcConfig(): { enabled: boolean; providerName: string } {
    return {
      enabled: this.oidcService.isEnabled(),
      providerName: this.oidcService.getProviderName(),
    };
  }

  /** Returns the IdP authorization URL. Frontend redirects the browser there. */
  @Public()
  @Get('oidc/authorize')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async oidcAuthorize(
    @Query('redirect') redirectAfterLogin?: string,
  ): Promise<{ authorizeUrl: string }> {
    const authorizeUrl = await this.oidcService.getAuthorizeUrl(redirectAfterLogin);
    return { authorizeUrl };
  }

  /**
   * IdP redirects here after user authentication.
   * Backend exchanges the code, provisions the user, issues an OTP,
   * then redirects the browser to the SPA callback page.
   */
  @Public()
  @Get('oidc/callback')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async oidcCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const frontendBase = process.env['FRONTEND_URL'] ?? 'http://localhost:4200';

    if (error || !code || !state) {
      const msg = encodeURIComponent(error ?? 'Anmeldung abgebrochen');
      void reply.code(302).header('location', `${frontendBase}/auth/callback?error=${msg}`).send('');
      return;
    }

    const ua = req.headers['user-agent'];
    const userAgent = Array.isArray(ua) ? ua[0] : ua;

    try {
      const { otpCode, redirectAfterLogin } = await this.oidcService.handleCallback(
        code,
        state,
        req.ip,
        userAgent,
      );

      const params = new URLSearchParams({ code: otpCode });
      if (redirectAfterLogin) params.set('redirect', redirectAfterLogin);

      void reply.code(302).header('location', `${frontendBase}/auth/callback?${params.toString()}`).send('');
    } catch {
      void reply.code(302).header('location', `${frontendBase}/auth/callback?error=${encodeURIComponent('Anmeldung fehlgeschlagen')}`).send('');
    }
  }

  /**
   * Exchanges the one-time OTP for a proper JWT token pair.
   * Called by the SPA after receiving the OTP from the callback URL.
   */
  @Public()
  @Post('handover')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async handover(
    @Body() body: HandoverBody,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ accessToken: string; user: AuthUser }> {
    if (!body.code) throw new BadRequestException('Code fehlt');

    const user = await this.oidcService.exchangeHandoverCode(body.code);
    const result = await this.authService.login(user, {}, {
      ip: req.ip,
      headers: req.headers as Record<string, string | string[] | undefined>,
    });

    if ('requiresTotp' in result && result.requiresTotp) {
      throw new BadRequestException('2FA erforderlich. Bitte zuerst einloggen.');
    }

    const tokenSet = result as { accessToken: string; refreshToken: string; refreshExpiresIn: number };
    void reply.setCookie('refresh_token', tokenSet.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: tokenSet.refreshExpiresIn,
    });

    return { accessToken: tokenSet.accessToken, user: this.authService.toAuthUser(user) };
  }

  /** Returns all linked OIDC identities for the current user. */
  @UseGuards(JwtAuthGuard)
  @Get('oidc/identities')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getOidcIdentities(
    @CurrentUser() payload: JwtPayload,
  ): Promise<{ providerName: string; email: string; createdAt: string; lastLoginAt: string | null }[]> {
    const identities = await this.oidcService.getIdentities(payload.sub);
    return identities.map(i => ({
      providerName: i.providerName,
      email: i.email,
      createdAt: i.createdAt.toISOString(),
      lastLoginAt: i.lastLoginAt?.toISOString() ?? null,
    }));
  }

  /** Unlinks an OIDC identity from the current user account. */
  @UseGuards(JwtAuthGuard)
  @Delete('oidc/identities/:providerName')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async unlinkOidcIdentity(
    @CurrentUser() payload: JwtPayload,
    @Param('providerName') providerName: string,
  ): Promise<void> {
    await this.oidcService.unlinkIdentity(payload.sub, providerName);
  }

  // ── TOTP / 2FA ─────────────────────────────────────────────────────

  /** Verifies TOTP code after login with tempToken and issues real tokens. */
  @Public()
  @Post('totp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyTotp(
    @Body() body: { tempToken: string; code: string; rememberMe?: boolean },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ accessToken: string; user: AuthUser }> {
    if (!body.tempToken || !body.code) {
      throw new BadRequestException('tempToken und Code erforderlich');
    }
    const result = await this.authService.verifyTotpAndLogin(
      body.tempToken,
      body.code,
      { rememberMe: body.rememberMe },
      {
        ip: req.ip,
        headers: req.headers as Record<string, string | string[] | undefined>,
      },
    );
    void reply.setCookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: result.refreshExpiresIn,
    });
    return { accessToken: result.accessToken, user: result.user };
  }

  /** Initiates 2FA setup - returns QR code URI (requires authentication). */
  @UseGuards(JwtAuthGuard)
  @Get('totp/setup')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async setupTotp(
    @CurrentUser() payload: JwtPayload,
  ): Promise<{ secret: string; uri: string }> {
    return this.authService.setupTotp(payload.sub);
  }

  /** Confirms and enables 2FA after verifying a TOTP code. */
  @UseGuards(JwtAuthGuard)
  @Post('totp/enable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async enableTotp(
    @CurrentUser() payload: JwtPayload,
    @Body() body: { code: string },
  ): Promise<void> {
    if (!body.code) throw new BadRequestException('Code erforderlich');
    await this.authService.verifyAndEnableTotp(payload.sub, body.code);
  }

  /** Disables 2FA for the current user. */
  @UseGuards(JwtAuthGuard)
  @Delete('totp')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async disableTotp(
    @CurrentUser() payload: JwtPayload,
  ): Promise<void> {
    await this.authService.disableTotp(payload.sub);
  }
}
