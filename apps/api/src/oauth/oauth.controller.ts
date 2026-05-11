import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../common/decorators/public.decorator';
import { OAUTH_SCOPES } from './oauth-scopes';
import { OAuthService } from './oauth.service';
import { OAuthExceptionFilter } from './oauth-exception.filter';

/**
 * OAuth 2.1 Authorization Server endpoints für den MCP-Endpoint.
 *
 * Discovery (RFC 8414, RFC 9728) lebt am Root der Domain (NICHT unter /api/v1/),
 * damit MCP-Clients sie unter dem Standard-Pfad finden. Die Routen werden in
 * main.ts vom globalen api/v1-Prefix ausgeschlossen.
 *
 * Auth-relevante Endpoints werden ebenfalls am Root erwartet (vgl. RFC 8414
 * Beispiel im Spec). Wir registrieren sie unter `/oauth2/...`.
 */
@ApiTags('OAuth Server')
@Controller()
@UseFilters(OAuthExceptionFilter)
export class OAuthController {
  constructor(
    private readonly config: ConfigService,
    private readonly service: OAuthService,
  ) {}

  private get baseUrl(): string {
    return this.config.get<string>('app.baseUrl', 'http://localhost:3000');
  }

  /**
   * RFC 8414 — OAuth 2.0 Authorization Server Metadata.
   * MCP-Clients lesen das, um Authorize/Token/Registration-Endpoints zu finden.
   */
  @Public()
  @Get('.well-known/oauth-authorization-server')
  @ApiOperation({
    summary: 'OAuth Authorization Server metadata (RFC 8414)',
    description: 'Public discovery document. MCP and OAuth clients fetch this to find authorize/token/registration/revocation endpoints, supported scopes, grant types, and code-challenge methods.',
  })
  @ApiResponse({
    status: 200,
    description: 'Server metadata.',
    schema: {
      example: {
        issuer: 'https://your-klar-instance.com',
        authorization_endpoint: 'https://your-klar-instance.com/oauth2/authorize',
        token_endpoint: 'https://your-klar-instance.com/oauth2/token',
        registration_endpoint: 'https://your-klar-instance.com/oauth2/register',
        revocation_endpoint: 'https://your-klar-instance.com/oauth2/revoke',
        scopes_supported: ['transactions:read', 'transactions:write'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
        code_challenge_methods_supported: ['S256'],
      },
    },
  })
  getAuthorizationServerMetadata(): Record<string, unknown> {
    const baseUrl = this.baseUrl;
    return {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth2/authorize`,
      token_endpoint: `${baseUrl}/oauth2/token`,
      registration_endpoint: `${baseUrl}/oauth2/register`,
      revocation_endpoint: `${baseUrl}/oauth2/revoke`,
      scopes_supported: [...OAUTH_SCOPES],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
      revocation_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
      code_challenge_methods_supported: ['S256'],
      service_documentation: `${baseUrl}/docs/mcp`,
    };
  }

  /**
   * RFC 9728 — OAuth 2.0 Protected Resource Metadata.
   * Wird auch im WWW-Authenticate-Header bei 401 referenziert.
   */
  @Public()
  @Get('.well-known/oauth-protected-resource')
  @ApiOperation({
    summary: 'OAuth Protected Resource metadata (RFC 9728)',
    description: 'Discovery document for the MCP resource server. Returned URL is also referenced from the WWW-Authenticate header on 401 responses.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resource metadata.',
    schema: {
      example: {
        resource: 'https://your-klar-instance.com/mcp',
        authorization_servers: ['https://your-klar-instance.com'],
        scopes_supported: ['transactions:read', 'transactions:write'],
        bearer_methods_supported: ['header'],
      },
    },
  })
  getProtectedResourceMetadata(): Record<string, unknown> {
    const baseUrl = this.baseUrl;
    return {
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      scopes_supported: [...OAUTH_SCOPES],
      bearer_methods_supported: ['header'],
      resource_documentation: `${baseUrl}/docs/mcp`,
    };
  }

  /**
   * RFC 7591 — Dynamic Client Registration.
   *
   * Rate-Limit: 5/h pro IP. Wir nutzen die Throttler-Konfiguration des
   * Frameworks; in Tests (`NODE_ENV=test`) wird sie automatisch deaktiviert.
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Post('oauth2/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Dynamic Client Registration (RFC 7591)',
    description: 'Registers a new OAuth client and returns its credentials. Body follows RFC 7591 (client_name, redirect_uris, token_endpoint_auth_method, scope, …). Rate-limited to 5 registrations per hour per IP.',
  })
  @ApiResponse({
    status: 201,
    description: 'Client registered.',
    schema: {
      example: {
        client_id: 'klar_7f9a2b3c8d1e',
        client_secret: 'sk_8d9e0f1a2b3c4d5e',
        client_name: 'My MCP Client',
        redirect_uris: ['http://localhost:8080/callback'],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: 'transactions:read',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid registration request.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (5 per hour).' })
  async registerClient(@Body() body: unknown): Promise<Record<string, unknown>> {
    const result = await this.service.registerClient(body, this.baseUrl);
    return result as unknown as Record<string, unknown>;
  }

  /**
   * GET /oauth2/authorize — von OAuth-Spec geforderter Browser-Endpoint.
   *
   * Wir validieren die Query-Parameter und leiten den User dann an die
   * Frontend-Consent-Page weiter (`${frontendUrl}/oauth/consent?<params>`).
   * Die eigentliche Authentifizierung + Approval läuft im SPA — das hat
   * Zugriff auf den Klar-Access-Token im Memory.
   *
   * Bei ungültiger Anfrage: redirect zur registrierten redirect_uri mit
   * `?error=...&state=...` (RFC 6749 §4.1.2.1), wenn die URI ableitbar ist;
   * sonst Plain-400.
   */
  /**
   * RFC 7009 — Token Revocation. Antwort immer 200, auch wenn der Token
   * unbekannt ist (Information-Leak-Schutz).
   */
  @Public()
  @Post('oauth2/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke an access or refresh token (RFC 7009)',
    description: 'Revokes the supplied token. Always returns 200 even if the token is unknown to avoid information leakage.',
  })
  @ApiResponse({ status: 200, description: 'Token revoked (or never existed).', schema: { example: { revoked: true } } })
  async revoke(@Body() body: unknown): Promise<{ revoked: true }> {
    await this.service.revokeToken(body);
    return { revoked: true };
  }

  /**
   * RFC 6749 §3.2 Token Endpoint.
   * Akzeptiert `application/x-www-form-urlencoded` (Standard) und `application/json`.
   * Cache-Header per RFC verpflichtend.
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('oauth2/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Token endpoint (RFC 6749 §3.2)',
    description: 'Exchanges an authorization code (with PKCE) for an access + refresh token, or refreshes an existing token. Accepts application/x-www-form-urlencoded or application/json. Sets Cache-Control: no-store as required by the spec.',
  })
  @ApiResponse({
    status: 200,
    description: 'Token response.',
    schema: {
      example: {
        access_token: 'mcp_at_7f9a2b3c8d1e4f5a',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'mcp_rt_8d9e0f1a2b3c4d5e',
        scope: 'transactions:read',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'invalid_request / invalid_grant / invalid_client (RFC 6749 §5.2).' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (30 per minute).' })
  async token(
    @Body() body: unknown,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.service.issueToken(body);
    void reply
      .code(HttpStatus.OK)
      .header('Cache-Control', 'no-store')
      .header('Pragma', 'no-cache')
      .send(result);
  }

  @Public()
  @Get('oauth2/authorize')
  @ApiOperation({
    summary: 'Authorize endpoint (browser entry point)',
    description: 'Validates the authorize request and 302-redirects either to the registered redirect_uri (on validation error, RFC 6749 §4.1.2.1) or to the SPA consent page where the user approves the requested scopes.',
  })
  @ApiQuery({ name: 'client_id', description: 'Registered client ID.', example: 'klar_7f9a2b3c8d1e' })
  @ApiQuery({ name: 'redirect_uri', description: 'Pre-registered redirect URI.', example: 'http://localhost:8080/callback' })
  @ApiQuery({ name: 'response_type', description: 'Must be "code".', example: 'code' })
  @ApiQuery({ name: 'scope', description: 'Space-separated requested scopes.', example: 'transactions:read', required: false })
  @ApiQuery({ name: 'state', description: 'Opaque value returned to the client unchanged.', example: 'state-7f9a2b3c', required: false })
  @ApiQuery({ name: 'code_challenge', description: 'PKCE challenge.', example: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', required: false })
  @ApiQuery({ name: 'code_challenge_method', description: 'PKCE method, must be S256.', example: 'S256', required: false })
  @ApiResponse({ status: 302, description: 'Redirects to consent page or error redirect.' })
  authorize(
    @Query() query: Record<string, string | undefined>,
    @Req() _req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): void {
    const { redirectUrl } = this.service.validateAuthorizeForRedirect(query);
    if (redirectUrl) {
      void reply.code(302).header('location', redirectUrl).send('');
      return;
    }
    const frontendUrl = this.config.get<string>('app.frontendUrl', 'http://localhost:4200');
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (typeof v === 'string') params.set(k, v);
    }
    const target = `${frontendUrl}/oauth/consent?${params.toString()}`;
    void reply.code(302).header('location', target).send('');
  }
}
