import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { OAuthScope } from '@klar/shared';
import type { RequestContext } from '../../common/types/request-context.type';
import { OAuthRepository } from '../../oauth/oauth.repository';
import { verifyMcpAccessToken } from '../../oauth/token.util';

/**
 * Bearer-Token-Guard für den MCP-Endpoint.
 *
 * Verifiziert:
 * 1. `Authorization: Bearer <jwt>` Header vorhanden
 * 2. JWT-Signatur (RS256) gegen MCP-Public-Key
 * 3. `aud === klar-mcp`
 * 4. `exp` nicht abgelaufen
 * 5. Grant existiert und ist nicht revoked (DB-Lookup über jti = grant.id)
 *
 * Setzt `req.reqContext` mit `source='mcp'`, scopes, mcpClientId, grantId.
 *
 * Bei Fehlern: 401 mit `WWW-Authenticate: Bearer realm="klar-mcp",
 * error="invalid_token", resource_metadata="<url>"` (RFC 9728 §5.3).
 */
@Injectable()
export class OAuthBearerGuard implements CanActivate {
  private cachedPublicKey?: Buffer;

  constructor(
    private readonly config: ConfigService,
    private readonly oauthRepo: OAuthRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<FastifyRequest & { reqContext: RequestContext }>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    const auth = req.headers['authorization'];
    if (!auth || Array.isArray(auth) || !auth.startsWith('Bearer ')) {
      this.setWwwAuthenticate(reply, 'invalid_token', 'missing bearer token');
      throw new UnauthorizedException('missing bearer token');
    }
    const token = auth.slice(7).trim();
    if (!token) {
      this.setWwwAuthenticate(reply, 'invalid_token', 'empty bearer token');
      throw new UnauthorizedException('empty bearer token');
    }

    const audience = this.config.get<string>('oauth.mcpAudience', 'klar-mcp');
    const issuer = this.config.get<string>('app.baseUrl', 'http://localhost:3000');
    const verification = verifyMcpAccessToken(token, this.publicKey(), audience, issuer);
    if (!verification.ok || !verification.claims) {
      this.setWwwAuthenticate(reply, 'invalid_token', verification.reason ?? 'invalid');
      throw new UnauthorizedException('invalid bearer token');
    }

    const claims = verification.claims;
    // Grant-ID liegt im jti — Revocation-Check.
    const grantId = claims.jti;
    if (!grantId) {
      this.setWwwAuthenticate(reply, 'invalid_token', 'missing jti');
      throw new UnauthorizedException('invalid bearer token');
    }
    const grant = await this.findGrant(grantId);
    if (!grant || grant.revokedAt) {
      this.setWwwAuthenticate(reply, 'invalid_token', 'grant revoked');
      throw new UnauthorizedException('grant revoked');
    }

    const scopes = claims.scope.split(/\s+/).filter(Boolean) as OAuthScope[];
    req.reqContext = {
      userId: claims.sub,
      householdId: claims.hh,
      source: 'mcp',
      mcpClientId: claims.azp,
      scopes,
      grantId,
    };
    return true;
  }

  private publicKey(): Buffer {
    if (this.cachedPublicKey) return this.cachedPublicKey;
    const path = this.config.get<string>('oauth.mcpPublicKeyPath');
    if (!path) {
      throw new UnauthorizedException('MCP signing key not configured');
    }
    this.cachedPublicKey = fs.readFileSync(path);
    return this.cachedPublicKey;
  }

  private findGrant(grantId: string): Promise<{ revokedAt: Date | null } | null> {
    return this.oauthRepo.findGrantStatusById(grantId);
  }

  private setWwwAuthenticate(reply: FastifyReply, error: string, description: string): void {
    const baseUrl = this.config.get<string>('app.baseUrl', 'http://localhost:3000');
    void reply.header(
      'WWW-Authenticate',
      `Bearer realm="klar-mcp", error="${error}", error_description="${description.replace(
        /"/g,
        "'",
      )}", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
    );
  }
}
