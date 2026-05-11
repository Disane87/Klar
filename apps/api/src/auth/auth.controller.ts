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
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RegisterResponse, AuthUser, RefreshResponse } from '@klar/shared';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { HandoverDto } from './dto/handover.dto';
import { TotpEnableDto, TotpVerifyDto } from './dto/totp-verify.dto';
import {
  AuthUserResponse,
  LoginSuccessResponse,
  MessageResponse,
  OidcAuthorizeUrlResponse,
  OidcConfigResponse,
  OidcIdentityResponse,
  RefreshResponseDto,
  RegisterResponseDto,
  SessionResponse,
  TotpChallengeResponse,
  TotpSetupResponse,
} from './dto/responses/auth-user.response';
import { OidcService } from '../oidc/oidc.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

@ApiTags('Auth')
@ApiExtraModels(LoginSuccessResponse, TotpChallengeResponse)
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly oidcService: OidcService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Register a new local account',
    description:
      'Creates a new user with email + password. The first ever registered user becomes app admin. Sends a verification email and optionally consumes an invite token to auto-join a household. Rate-limited to 3 attempts per minute per IP.',
  })
  @ApiResponse({ status: 201, description: 'Account created; verification email queued.', type: RegisterResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed or registration is disabled on this instance.' })
  @ApiResponse({ status: 409, description: 'An account with this email already exists.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (3 attempts per minute).' })
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
  @ApiOperation({
    summary: 'Local password login',
    description:
      'Validates email + password and either returns an access token (with refresh_token cookie) or signals that 2FA is required by returning { requiresTotp: true, tempToken } — the SPA then calls POST /auth/totp/verify.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful or 2FA challenge issued.',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(LoginSuccessResponse) },
        { $ref: getSchemaPath(TotpChallengeResponse) },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Email or password incorrect.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (5 attempts per minute).' })
  async login(
    @Body() body: LoginDto,
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
  @ApiBearerAuth('jwt')
  @ApiCookieAuth('refresh_token')
  @ApiOperation({
    summary: 'Log out the current session',
    description:
      'Revokes the refresh token from the cookie and clears the cookie. Other sessions of the same user keep working.',
  })
  @ApiResponse({ status: 204, description: 'Session revoked and cookie cleared.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
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
  @ApiCookieAuth('refresh_token')
  @ApiOperation({
    summary: 'Rotate refresh token and issue a new access token',
    description:
      'Reads the refresh_token cookie, rotates it (old one revoked, new one set), and returns a fresh access token.',
  })
  @ApiResponse({ status: 200, description: 'New access token issued.', type: RefreshResponseDto })
  @ApiResponse({ status: 400, description: 'No refresh_token cookie present.' })
  @ApiResponse({ status: 401, description: 'Refresh token invalid, revoked, or expired.' })
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
  @ApiOperation({
    summary: 'Verify an email address',
    description:
      'Confirms the email address using the one-time token sent in the verification email. Idempotent — calling it again on a verified token returns 400.',
  })
  @ApiQuery({
    name: 'token',
    description: 'One-time verification token from the email link.',
    example: 'vrf_7f9a2b3c8d1e4f5a',
  })
  @ApiResponse({ status: 200, description: 'Email verified.', type: MessageResponse })
  @ApiResponse({ status: 400, description: 'Token missing, invalid, or already used.' })
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
  @ApiOperation({
    summary: 'Resend the verification email',
    description:
      'Triggers a new verification email if the address exists and is unverified. Always returns the same neutral message to prevent account enumeration. Rate-limited to 2 calls per 5 minutes per IP.',
  })
  @ApiResponse({ status: 200, description: 'Verification email queued (if applicable).', type: MessageResponse })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (2 per 5 minutes).' })
  async resendVerification(@Body() body: ResendVerificationDto): Promise<{ message: string }> {
    await this.authService.resendVerification(body.email);
    return { message: 'Falls eine passende E-Mail-Adresse existiert, wurde eine neue E-Mail gesendet.' };
  }

  // ── OIDC endpoints ────────────────────────────────────────────────────────

  /** Returns whether OIDC is enabled and the display name. Used by the login page. */
  @Public()
  @Get('oidc/config')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiTags('Auth · OIDC')
  @ApiOperation({
    summary: 'Get OIDC provider configuration',
    description: 'Returns whether OIDC login is enabled on this instance and the configured provider display name. Used by the SPA login page to render the SSO button.',
  })
  @ApiResponse({ status: 200, description: 'OIDC configuration.', type: OidcConfigResponse })
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
  @ApiTags('Auth · OIDC')
  @ApiOperation({
    summary: 'Build an OIDC authorize URL',
    description: 'Generates the IdP authorization URL with state and PKCE; the SPA navigates the browser there to start the OIDC flow.',
  })
  @ApiQuery({
    name: 'redirect',
    required: false,
    description: 'Frontend URL to return to after successful login.',
    example: '/app/dashboard',
  })
  @ApiResponse({ status: 200, description: 'Authorize URL.', type: OidcAuthorizeUrlResponse })
  @ApiResponse({ status: 400, description: 'OIDC is not enabled on this instance.' })
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
  @ApiTags('Auth · OIDC')
  @ApiOperation({
    summary: 'OIDC callback (browser redirect target)',
    description: 'Handles the IdP redirect, exchanges the auth code, provisions or links the user, issues a one-time handover code, and 302-redirects the browser to the SPA callback page. Errors are forwarded to the SPA via ?error=... so they can be displayed.',
  })
  @ApiQuery({ name: 'code', required: false, description: 'Authorization code returned by the IdP.', example: 'abc123def456' })
  @ApiQuery({ name: 'state', required: false, description: 'CSRF/PKCE state value.', example: 'state-7f9a2b3c' })
  @ApiQuery({ name: 'error', required: false, description: 'IdP error code if the flow failed.' })
  @ApiQuery({ name: 'iss', required: false, description: 'Issuer (RFC 9207) — validated against the configured provider.' })
  @ApiResponse({ status: 302, description: 'Redirects the browser back to the SPA callback page.' })
  async oidcCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Query('iss') iss: string | undefined,
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
        iss,
      );

      const params = new URLSearchParams({ code: otpCode });
      if (redirectAfterLogin) params.set('redirect', redirectAfterLogin);

      void reply.code(302).header('location', `${frontendBase}/auth/callback?${params.toString()}`).send('');
    } catch (err) {
      this.logger.error(err, 'OIDC callback failed');
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
  @ApiTags('Auth · OIDC')
  @ApiOperation({
    summary: 'Exchange OIDC handover code for tokens',
    description: 'Called by the SPA after the OIDC callback redirected back with a one-time code. Trades that code for a proper access token + refresh_token cookie. Fails if the OIDC user has 2FA enabled — those users must use the local-login flow.',
  })
  @ApiResponse({ status: 200, description: 'Tokens issued.', type: LoginSuccessResponse })
  @ApiResponse({ status: 400, description: 'Code missing, invalid, expired, or 2FA required.' })
  async handover(
    @Body() body: HandoverDto,
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
  @ApiTags('Auth · OIDC')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'List linked OIDC identities',
    description: 'Returns all external OIDC identities currently linked to the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'List of linked identities.', type: OidcIdentityResponse, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
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
  @ApiTags('Auth · OIDC')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Unlink an OIDC identity',
    description: 'Removes the link between the user account and the given OIDC provider. The password identity is required to remain — unlinking the last login method is rejected.',
  })
  @ApiParam({ name: 'providerName', description: 'Provider name to unlink.', example: 'pocketid' })
  @ApiResponse({ status: 204, description: 'Identity unlinked.' })
  @ApiResponse({ status: 400, description: 'Cannot unlink the only remaining login method.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'No identity for that provider linked to this user.' })
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
  @ApiTags('Auth · 2FA')
  @ApiOperation({
    summary: 'Verify TOTP code and finish login',
    description: 'Completes a 2FA-required login: trades the tempToken from /auth/login plus a TOTP code for a real access token + refresh_token cookie.',
  })
  @ApiResponse({ status: 200, description: 'Login completed.', type: LoginSuccessResponse })
  @ApiResponse({ status: 400, description: 'Missing tempToken or code.' })
  @ApiResponse({ status: 401, description: 'TOTP code incorrect or tempToken expired.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded.' })
  async verifyTotp(
    @Body() body: TotpVerifyDto,
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
  @ApiTags('Auth · 2FA')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Begin TOTP setup',
    description: 'Generates a fresh TOTP secret and otpauth:// URI for the authenticator app. Setup is not active until confirmed via POST /auth/totp/enable with a valid code.',
  })
  @ApiResponse({ status: 200, description: 'Setup data.', type: TotpSetupResponse })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
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
  @ApiTags('Auth · 2FA')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Activate TOTP after verifying a code',
    description: 'Confirms the TOTP setup by verifying a code from the authenticator app and persists 2FA as enabled for the user.',
  })
  @ApiResponse({ status: 204, description: '2FA enabled.' })
  @ApiResponse({ status: 400, description: 'Code missing or no setup in progress.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token, or TOTP code incorrect.' })
  async enableTotp(
    @CurrentUser() payload: JwtPayload,
    @Body() body: TotpEnableDto,
  ): Promise<void> {
    if (!body.code) throw new BadRequestException('Code erforderlich');
    await this.authService.verifyAndEnableTotp(payload.sub, body.code);
  }

  /** Disables 2FA for the current user. */
  @UseGuards(JwtAuthGuard)
  @Delete('totp')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiTags('Auth · 2FA')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Disable TOTP for the current user',
    description: 'Removes the stored TOTP secret and disables 2FA. Future logins succeed without a TOTP code.',
  })
  @ApiResponse({ status: 204, description: '2FA disabled.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async disableTotp(
    @CurrentUser() payload: JwtPayload,
  ): Promise<void> {
    await this.authService.disableTotp(payload.sub);
  }
}

/**
 * Sessions controller — Settings/Security UI lists active refresh tokens
 * (= sessions) and lets the user revoke individual ones.
 *
 * Mounted on /me/sessions, separate from /auth so the frontend can call it
 * without going through the cookie-bound auth flow.
 */
@ApiTags('Auth · Sessions')
@ApiBearerAuth('jwt')
@Controller('me/sessions')
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class SessionsController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'List active sessions',
    description: 'Lists all active refresh tokens of the current user. Used by the Security settings page to show "where am I logged in".',
  })
  @ApiResponse({ status: 200, description: 'Active sessions.', type: SessionResponse, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async list(@CurrentUser() payload: JwtPayload) {
    return this.authService.listSessions(payload.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Revoke a session',
    description: 'Revokes a specific session (refresh token) by ID. The targeted session is logged out immediately.',
  })
  @ApiParam({ name: 'id', description: 'Session/refresh-token ID to revoke.', example: '7f9a2b3c-8d1e-4f5a-9b7c-8d9e0f1a2b3c' })
  @ApiResponse({ status: 204, description: 'Session revoked.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Session not found or not owned by the current user.' })
  async revoke(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    const revoked = await this.authService.revokeSession(payload.sub, id);
    if (!revoked) {
      throw new NotFoundException(`Session ${id} nicht gefunden`);
    }
  }
}
