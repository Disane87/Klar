import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as argon2 from 'argon2';
import { OAuthService } from './oauth.service';
import { OAuthError } from './oauth-error';
import type { OAuthRepository } from './oauth.repository';

function makeService(): {
  service: OAuthService;
  repo: {
    createClient: ReturnType<typeof vi.fn>;
    findClientByClientId: ReturnType<typeof vi.fn>;
    findConsent: ReturnType<typeof vi.fn>;
    upsertConsent: ReturnType<typeof vi.fn>;
    createAuthCode: ReturnType<typeof vi.fn>;
  };
} {
  const repo = {
    createClient: vi.fn().mockResolvedValue(undefined),
    findClientByClientId: vi.fn().mockResolvedValue(null),
    findConsent: vi.fn().mockResolvedValue(null),
    upsertConsent: vi.fn().mockResolvedValue(undefined),
    createAuthCode: vi.fn().mockResolvedValue(undefined),
  };
  const config = {
    get: vi.fn((key: string, def: unknown) => def),
  };
  const service = new OAuthService(
    repo as unknown as OAuthRepository,
    config as unknown as import('@nestjs/config').ConfigService,
  );
  return { service, repo };
}

describe('OAuthService.registerClient', () => {
  let service: OAuthService;
  let repo: { createClient: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    ({ service, repo } = makeService());
  });

  it('registers a public PKCE client with default fields', async () => {
    const res = await service.registerClient(
      {
        client_name: 'Claude Desktop',
        redirect_uris: ['http://localhost:33418/cb'],
      },
      'https://klar.test',
    );

    expect(res.client_id).toMatch(/^klar_mcp_[0-9a-f]{24}$/);
    expect(res.client_secret).toBeUndefined();
    expect(res.token_endpoint_auth_method).toBe('none');
    expect(res.grant_types).toEqual(['authorization_code', 'refresh_token']);
    expect(res.response_types).toEqual(['code']);
    expect(res.client_secret_expires_at).toBe(0);
    expect(res.registration_access_token).toMatch(/^klar_rat_[0-9a-f]{48}$/);
    expect(res.registration_client_uri).toBe(
      `https://klar.test/oauth2/register/${res.client_id}`,
    );

    expect(repo.createClient).toHaveBeenCalledTimes(1);
    const stored = repo.createClient.mock.calls[0][0];
    expect(stored.clientSecretHash).toBeNull();
    expect(stored.tokenEndpointAuthMethod).toBe('none');
    expect(stored.registrationAccessTokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('issues a hashed client_secret for client_secret_post', async () => {
    const res = await service.registerClient(
      {
        client_name: 'Server App',
        redirect_uris: ['https://app.example.com/cb'],
        token_endpoint_auth_method: 'client_secret_post',
      },
      'https://klar.test',
    );

    expect(res.client_secret).toMatch(/^klar_cs_[0-9a-f]{48}$/);
    const stored = repo.createClient.mock.calls[0][0];
    expect(stored.clientSecretHash).toBeTruthy();
    expect(stored.clientSecretHash.startsWith('$argon2id$')).toBe(true);

    // Plaintext muss gegen den Hash verifizieren.
    const ok = await argon2.verify(stored.clientSecretHash, res.client_secret as string);
    expect(ok).toBe(true);
  });

  it.each([
    ['empty redirect_uris', { client_name: 'x', redirect_uris: [] }],
    ['plain http on public host', { client_name: 'x', redirect_uris: ['http://evil.example/cb'] }],
    ['fragment in URI', { client_name: 'x', redirect_uris: ['https://x.test/cb#frag'] }],
    ['empty client_name', { client_name: '', redirect_uris: ['https://x.test/cb'] }],
    ['too many uris', {
      client_name: 'x',
      redirect_uris: Array.from({ length: 6 }, (_, i) => `https://x${i}.test/cb`),
    }],
    ['malformed uri', { client_name: 'x', redirect_uris: ['not a url'] }],
  ])('rejects %s', async (_label, payload) => {
    await expect(
      service.registerClient(payload, 'https://klar.test'),
    ).rejects.toBeInstanceOf(OAuthError);
    expect(repo.createClient).not.toHaveBeenCalled();
  });

  it('uses error code invalid_redirect_uri when URI fails', async () => {
    try {
      await service.registerClient(
        { client_name: 'x', redirect_uris: ['http://evil.example/cb'] },
        'https://klar.test',
      );
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(OAuthError);
      expect((err as OAuthError).code).toBe('invalid_redirect_uri');
    }
  });

  it('uses error code invalid_client_metadata for non-URI errors', async () => {
    try {
      await service.registerClient(
        { client_name: '', redirect_uris: ['https://x.test/cb'] },
        'https://klar.test',
      );
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(OAuthError);
      expect((err as OAuthError).code).toBe('invalid_client_metadata');
    }
  });

  it('accepts loopback http and IPv6 loopback', async () => {
    const res = await service.registerClient(
      {
        client_name: 'cli',
        redirect_uris: ['http://127.0.0.1:33418/cb', 'http://[::1]:9000/cb'],
      },
      'https://klar.test',
    );
    expect(res.redirect_uris).toHaveLength(2);
  });

  it('accepts custom-scheme native redirect URIs', async () => {
    const res = await service.registerClient(
      {
        client_name: 'native',
        redirect_uris: ['myapp:/callback'],
      },
      'https://klar.test',
    );
    expect(res.redirect_uris).toEqual(['myapp:/callback']);
  });
});
