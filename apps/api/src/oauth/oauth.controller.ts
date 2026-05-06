import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
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
  async registerClient(@Body() body: unknown): Promise<Record<string, unknown>> {
    const result = await this.service.registerClient(body, this.baseUrl);
    return result as unknown as Record<string, unknown>;
  }
}
