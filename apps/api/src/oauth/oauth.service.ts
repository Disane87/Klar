import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ZodError } from 'zod';
import { OAuthRepository } from './oauth.repository';
import {
  generateClientId,
  generateClientSecret,
  generateRegistrationAccessToken,
  sha256Hex,
} from './random.util';
import { registerClientSchema, type RegisterClientInput } from './dto/register-client.dto';
import { OAuthError } from './oauth-error';

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

@Injectable()
export class OAuthService {
  constructor(private readonly repo: OAuthRepository) {}

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
