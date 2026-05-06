import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { ZodError } from 'zod';
import { OAuthRepository } from './oauth.repository';
import { isScopeSubset, type OAuthScope, SCOPE_DISPLAY } from './oauth-scopes';
import {
  generateAuthorizationCode,
  generateClientId,
  generateClientSecret,
  generateRefreshToken,
  generateRegistrationAccessToken,
  sha256Hex,
} from './random.util';
import { registerClientSchema, type RegisterClientInput } from './dto/register-client.dto';
import { authorizeQuerySchema, type AuthorizeQuery } from './dto/authorize-query.dto';
import { consentDecisionSchema } from './dto/consent-decision.dto';
import { tokenRequestSchema, type TokenRequest } from './dto/token-request.dto';
import { OAuthError } from './oauth-error';
import { signMcpAccessToken } from './token.util';
import { verifyS256 } from './pkce.util';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

export interface RegisteredClientResponse {
  client_id: string;
  client_id_issued_at: number;
  /** Nur gesetzt bei `client_secret_post`. Wird einmalig zurückgegeben. */
  client_secret?: string;
  /** 0 = no expiry (per RFC 7591 §3.2.1) */
  client_secret_expires_at: number;
  registration_access_token: string;
  registration_client_uri: string;
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method: 'none' | 'client_secret_post';
  grant_types: string[];
  response_types: string[];
  logo_uri?: string;
  client_uri?: string;
  tos_uri?: string;
  policy_uri?: string;
}

export interface ConsentInfo {
  client: {
    clientId: string;
    clientName: string;
    logoUri: string | null;
    clientUri: string | null;
    tosUri: string | null;
    policyUri: string | null;
  };
  scopes: { id: OAuthScope; title: string; desc: string; icon: string }[];
  redirectUri: string;
  state: string;
  autoApprove: boolean;
}

export interface IssuedAuthCode {
  redirectUrl: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly repo: OAuthRepository,
    private readonly config: ConfigService,
  ) {}

  // ── Phase 4: Authorize-Validation ────────────────────────────────────

  /**
   * Validiert Authorize-Query und resolved Client. Gibt eine Beschreibung der
   * Anfrage zurück, die das Frontend für den Consent-Screen rendert.
   *
   * Bei autoApprove=true kann das Frontend direkt POST /consent mit approve=true
   * aufrufen und den Screen überspringen.
   */
  async describeAuthorizeRequest(rawQuery: unknown, userId: string): Promise<ConsentInfo> {
    const q = this.parseAuthorize(rawQuery);
    const client = await this.repo.findClientByClientId(q.client_id);
    if (!client || client.disabled) {
      throw new OAuthError('invalid_client', 'unknown or disabled client');
    }
    if (!client.redirectUris.includes(q.redirect_uri)) {
      throw new OAuthError('invalid_redirect_uri', 'redirect_uri is not registered for this client');
    }

    const requestedScopes = q.scope.split(/\s+/).filter(Boolean) as OAuthScope[];
    const consent = await this.repo.findConsent(userId, q.client_id);
    const granted = (consent?.scopes ?? []) as OAuthScope[];
    const autoApprove = consent !== null && isScopeSubset(requestedScopes, granted);

    return {
      client: {
        clientId: client.clientId,
        clientName: client.clientName,
        logoUri: client.logoUri,
        clientUri: client.clientUri,
        tosUri: client.tosUri,
        policyUri: client.policyUri,
      },
      scopes: requestedScopes.map((id) => ({ id, ...SCOPE_DISPLAY[id] })),
      redirectUri: q.redirect_uri,
      state: q.state,
      autoApprove,
    };
  }

  /**
   * Approve / Deny — gibt im Approve-Fall einen frischen Authorization-Code
   * aus und liefert die Redirect-URL fürs Frontend.
   *
   * Bei Deny wird die Redirect-URL mit `error=access_denied` zurückgegeben
   * (RFC 6749 §4.1.2.1).
   */
  async decideConsent(
    rawBody: unknown,
    user: { userId: string; householdId: string },
  ): Promise<IssuedAuthCode> {
    let parsed: ReturnType<typeof consentDecisionSchema.parse>;
    try {
      parsed = consentDecisionSchema.parse(rawBody);
    } catch (err) {
      throw this.zodToOAuthError(err);
    }

    const client = await this.repo.findClientByClientId(parsed.client_id);
    if (!client || client.disabled) {
      throw new OAuthError('invalid_client', 'unknown or disabled client');
    }
    if (!client.redirectUris.includes(parsed.redirect_uri)) {
      throw new OAuthError('invalid_redirect_uri', 'redirect_uri is not registered for this client');
    }

    if (!parsed.approve) {
      // RFC 6749 §4.1.2.1
      const url = new URL(parsed.redirect_uri);
      url.searchParams.set('error', 'access_denied');
      url.searchParams.set('error_description', 'user denied the authorization request');
      url.searchParams.set('state', parsed.state);
      return { redirectUrl: url.toString() };
    }

    const requestedScopes = parsed.scope.split(/\s+/).filter(Boolean) as OAuthScope[];

    // Consent persistieren — Scope-Union mit bestehenden Scopes.
    const existing = await this.repo.findConsent(user.userId, parsed.client_id);
    const merged = Array.from(
      new Set([...(existing?.scopes ?? []), ...requestedScopes]),
    ) as OAuthScope[];
    await this.repo.upsertConsent(user.userId, parsed.client_id, merged);

    // Authorization-Code generieren.
    const ttl = this.config.get<number>('oauth.authCodeTtlSeconds', 60);
    const code = generateAuthorizationCode();
    await this.repo.createAuthCode({
      codeHash: sha256Hex(code),
      clientId: parsed.client_id,
      userId: user.userId,
      householdId: user.householdId,
      scopes: requestedScopes,
      redirectUri: parsed.redirect_uri,
      codeChallenge: parsed.code_challenge,
      codeChallengeMethod: 'S256',
      expiresAt: new Date(Date.now() + ttl * 1000),
    });

    const url = new URL(parsed.redirect_uri);
    url.searchParams.set('code', code);
    url.searchParams.set('state', parsed.state);
    return { redirectUrl: url.toString() };
  }

  /**
   * Wandelt validierungs-fehlerhafte Query-Params in eine Redirect-Response um,
   * wenn redirect_uri ableitbar ist (RFC 6749 §4.1.2.1). Sonst werfen wir eine
   * Plain-400.
   */
  validateAuthorizeForRedirect(rawQuery: unknown): { redirectUrl: string | null } {
    try {
      this.parseAuthorize(rawQuery);
      return { redirectUrl: null };
    } catch (err) {
      if (err instanceof OAuthError) {
        const q = rawQuery as Record<string, string | undefined>;
        const redirectUri = q?.['redirect_uri'];
        const state = q?.['state'];
        if (redirectUri && /^https?:\/\//.test(redirectUri)) {
          try {
            const url = new URL(redirectUri);
            url.searchParams.set('error', err.code);
            if (err.toBody().error_description) {
              url.searchParams.set('error_description', err.toBody().error_description ?? '');
            }
            if (state) url.searchParams.set('state', state);
            return { redirectUrl: url.toString() };
          } catch {
            // fall through
          }
        }
      }
      throw err;
    }
  }

  // ── Phase 6: Token Endpoint ─────────────────────────────────────────

  /**
   * RFC 6749 §3.2 Token Endpoint. Discriminated Union via `grant_type`.
   *
   * Sicherheits-Highlights:
   * - Single-use Code: `consumeAuthCode` ist atomar; Replay → Cascade-Revoke.
   * - PKCE-S256 mandatory. `plain` ist auf Schema-Ebene schon ausgeschlossen.
   * - Refresh-Token rotating: alter Grant wird revoked, neuer ausgegeben.
   */
  async issueToken(rawBody: unknown): Promise<TokenResponse> {
    let parsed: TokenRequest;
    try {
      parsed = tokenRequestSchema.parse(rawBody);
    } catch (err) {
      throw this.zodToOAuthError(err);
    }

    if (parsed.grant_type === 'authorization_code') {
      return this.exchangeAuthorizationCode(parsed);
    }
    return this.exchangeRefreshToken(parsed);
  }

  private async exchangeAuthorizationCode(
    parsed: Extract<TokenRequest, { grant_type: 'authorization_code' }>,
  ): Promise<TokenResponse> {
    const client = await this.assertClient(parsed.client_id, parsed.client_secret);

    const codeHash = sha256Hex(parsed.code);
    const record = await this.repo.findAuthCodeByHash(codeHash);
    if (!record) {
      throw new OAuthError('invalid_grant', 'unknown authorization code');
    }
    if (record.clientId !== parsed.client_id) {
      throw new OAuthError('invalid_grant', 'code was issued to a different client');
    }
    if (record.redirectUri !== parsed.redirect_uri) {
      throw new OAuthError('invalid_grant', 'redirect_uri does not match');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new OAuthError('invalid_grant', 'authorization code expired');
    }
    // Replay-Versuch: Code wurde schon verbraucht.
    if (record.consumedAt) {
      // RFC 6819 §5.2.1.1 — bei Code-Replay alle bestehenden Grants des Clients revoken.
      await this.repo.revokeAllGrantsForClient(record.clientId);
      throw new OAuthError('invalid_grant', 'authorization code already used');
    }

    if (record.codeChallengeMethod !== 'S256' || !verifyS256(parsed.code_verifier, record.codeChallenge)) {
      throw new OAuthError('invalid_grant', 'pkce verification failed');
    }

    // Atomic mark-as-consumed. Wenn 0 Zeilen betroffen → Race-Replay.
    const consumed = await this.repo.consumeAuthCode(codeHash);
    if (!consumed) {
      await this.repo.revokeAllGrantsForClient(record.clientId);
      throw new OAuthError('invalid_grant', 'authorization code already used');
    }

    const refreshToken = generateRefreshToken();
    const refreshHash = sha256Hex(refreshToken);
    const refreshTtl = this.config.get<number>('oauth.refreshTokenTtlSeconds', 30 * 24 * 3600);
    const grant = await this.repo.createGrant({
      clientId: record.clientId,
      userId: record.userId,
      householdId: record.householdId,
      scopes: record.scopes,
      refreshTokenHash: refreshHash,
      refreshExpiresAt: new Date(Date.now() + refreshTtl * 1000),
    });

    return this.buildTokenResponse(grant.id, {
      userId: record.userId,
      householdId: record.householdId,
      clientId: record.clientId,
      scopes: record.scopes as OAuthScope[],
    }, refreshToken);
  }

  private async exchangeRefreshToken(
    parsed: Extract<TokenRequest, { grant_type: 'refresh_token' }>,
  ): Promise<TokenResponse> {
    await this.assertClient(parsed.client_id, parsed.client_secret);

    const grant = await this.repo.findGrantByRefreshHash(sha256Hex(parsed.refresh_token));
    if (!grant) {
      throw new OAuthError('invalid_grant', 'unknown refresh_token');
    }
    if (grant.clientId !== parsed.client_id) {
      throw new OAuthError('invalid_grant', 'refresh_token was issued to a different client');
    }
    if (grant.revokedAt || grant.refreshExpiresAt.getTime() < Date.now()) {
      throw new OAuthError('invalid_grant', 'refresh_token revoked or expired');
    }

    const grantedScopes = grant.scopes as OAuthScope[];
    let issueScopes: OAuthScope[] = grantedScopes;
    if (parsed.scope) {
      const requested = parsed.scope.split(/\s+/).filter(Boolean) as OAuthScope[];
      if (!isScopeSubset(requested, grantedScopes)) {
        throw new OAuthError('invalid_scope', 'scope is not a subset of granted scopes');
      }
      issueScopes = requested;
    }

    // Rotate: alten Grant revoken, neuen anlegen.
    await this.repo.revokeGrant(grant.id);
    const newRefreshToken = generateRefreshToken();
    const refreshTtl = this.config.get<number>('oauth.refreshTokenTtlSeconds', 30 * 24 * 3600);
    const newGrant = await this.repo.createGrant({
      clientId: grant.clientId,
      userId: grant.userId,
      householdId: grant.householdId,
      scopes: issueScopes,
      refreshTokenHash: sha256Hex(newRefreshToken),
      refreshExpiresAt: new Date(Date.now() + refreshTtl * 1000),
    });

    return this.buildTokenResponse(newGrant.id, {
      userId: grant.userId,
      householdId: grant.householdId,
      clientId: grant.clientId,
      scopes: issueScopes,
    }, newRefreshToken);
  }

  private buildTokenResponse(
    jti: string,
    ctx: { userId: string; householdId: string; clientId: string; scopes: OAuthScope[] },
    refreshToken: string,
  ): TokenResponse {
    const issuer = this.config.get<string>('app.baseUrl', 'http://localhost:3000');
    const audience = this.config.get<string>('oauth.mcpAudience', 'klar-mcp');
    const ttl = this.config.get<number>('oauth.accessTokenTtlSeconds', 3600);
    const privateKeyPath = this.config.get<string>('oauth.mcpPrivateKeyPath');
    if (!privateKeyPath) {
      throw new OAuthError('server_error', 'MCP signing key not configured');
    }
    const privateKey = fs.readFileSync(privateKeyPath);

    const { token, expiresIn } = signMcpAccessToken({
      userId: ctx.userId,
      householdId: ctx.householdId,
      clientId: ctx.clientId,
      scopes: ctx.scopes,
      ttlSeconds: ttl,
      issuer,
      audience,
      privateKey,
      jti,
    });

    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: expiresIn,
      refresh_token: refreshToken,
      scope: ctx.scopes.join(' '),
    };
  }

  private async assertClient(
    clientId: string,
    clientSecret: string | undefined,
  ): Promise<{ tokenEndpointAuthMethod: string }> {
    const client = await this.repo.findClientByClientId(clientId);
    if (!client || client.disabled) {
      throw new OAuthError('invalid_client', 'unknown or disabled client');
    }

    if (client.tokenEndpointAuthMethod === 'client_secret_post') {
      if (!clientSecret) {
        throw new OAuthError('invalid_client', 'client_secret required');
      }
      if (!client.clientSecretHash) {
        throw new OAuthError('invalid_client', 'client misconfigured');
      }
      const ok = await argon2.verify(client.clientSecretHash, clientSecret);
      if (!ok) throw new OAuthError('invalid_client', 'bad client_secret');
    }

    return { tokenEndpointAuthMethod: client.tokenEndpointAuthMethod };
  }

  // generateRandomJti ist für Tests/Mocks gut sichtbar zu haben
  protected newJti(): string {
    return randomUUID();
  }

  private parseAuthorize(rawQuery: unknown): AuthorizeQuery {
    try {
      return authorizeQuerySchema.parse(rawQuery);
    } catch (err) {
      throw this.zodToOAuthError(err);
    }
  }

  private zodToOAuthError(err: unknown): OAuthError {
    const description =
      err instanceof ZodError
        ? err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')
        : err instanceof Error
          ? err.message
          : 'invalid request';
    if (/redirect_uri/i.test(description)) {
      return new OAuthError('invalid_redirect_uri', description);
    }
    if (/response_type/i.test(description)) {
      return new OAuthError('unsupported_response_type', description);
    }
    if (/scope/i.test(description)) {
      return new OAuthError('invalid_scope', description);
    }
    return new OAuthError('invalid_request', description);
  }

  /**
   * RFC 7591 — Dynamic Client Registration.
   *
   * Wirft `BadRequestException` mit RFC-7591-konformen `error`-Codes:
   * - `invalid_redirect_uri` — wenn URI-Validierung schlägt
   * - `invalid_client_metadata` — alle anderen Validierungsfehler
   */
  async registerClient(
    raw: unknown,
    issuerBaseUrl: string,
  ): Promise<RegisteredClientResponse> {
    let parsed: ReturnType<typeof registerClientSchema.parse>;
    try {
      parsed = registerClientSchema.parse(raw);
    } catch (err) {
      const description =
        err instanceof ZodError
          ? err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')
          : err instanceof Error
            ? err.message
            : 'invalid client metadata';
      const isUriIssue = /redirect_uri/i.test(description);
      throw new OAuthError(
        isUriIssue ? 'invalid_redirect_uri' : 'invalid_client_metadata',
        description,
      );
    }

    const clientId = generateClientId();
    const registrationAccessToken = generateRegistrationAccessToken();

    let clientSecret: string | undefined;
    let clientSecretHash: string | null = null;
    if (parsed.token_endpoint_auth_method === 'client_secret_post') {
      clientSecret = generateClientSecret();
      clientSecretHash = await argon2.hash(clientSecret, ARGON2_OPTIONS);
    }

    await this.repo.createClient({
      clientId,
      clientSecretHash,
      clientName: parsed.client_name,
      redirectUris: parsed.redirect_uris,
      logoUri: parsed.logo_uri ?? null,
      clientUri: parsed.client_uri ?? null,
      tosUri: parsed.tos_uri ?? null,
      policyUri: parsed.policy_uri ?? null,
      tokenEndpointAuthMethod: parsed.token_endpoint_auth_method,
      registrationAccessTokenHash: sha256Hex(registrationAccessToken),
    });

    const issuedAt = Math.floor(Date.now() / 1000);
    const response: RegisteredClientResponse = {
      client_id: clientId,
      client_id_issued_at: issuedAt,
      client_secret_expires_at: 0,
      registration_access_token: registrationAccessToken,
      registration_client_uri: `${issuerBaseUrl}/oauth2/register/${clientId}`,
      client_name: parsed.client_name,
      redirect_uris: parsed.redirect_uris,
      token_endpoint_auth_method: parsed.token_endpoint_auth_method,
      grant_types: parsed.grant_types,
      response_types: parsed.response_types,
    };

    if (clientSecret !== undefined) {
      response.client_secret = clientSecret;
    }
    if (parsed.logo_uri) response.logo_uri = parsed.logo_uri;
    if (parsed.client_uri) response.client_uri = parsed.client_uri;
    if (parsed.tos_uri) response.tos_uri = parsed.tos_uri;
    if (parsed.policy_uri) response.policy_uri = parsed.policy_uri;

    return response;
  }
}

export type { RegisterClientInput };
