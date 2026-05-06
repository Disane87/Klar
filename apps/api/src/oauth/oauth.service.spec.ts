import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as argon2 from 'argon2';
import { OAuthService } from './oauth.service';
import { OAuthError } from './oauth-error';
import type { OAuthRepository } from './oauth.repository';

type RepoMock = Record<string, ReturnType<typeof vi.fn>>;

function makeService(repoOverrides: Partial<RepoMock> = {}, configMap: Record<string, unknown> = {}): {
  service: OAuthService;
  repo: RepoMock;
  audit: { log: ReturnType<typeof vi.fn> };
} {
  const repo: RepoMock = {
    createClient: vi.fn().mockResolvedValue(undefined),
    findClientByClientId: vi.fn().mockResolvedValue(null),
    findConsent: vi.fn().mockResolvedValue(null),
    upsertConsent: vi.fn().mockResolvedValue(undefined),
    createAuthCode: vi.fn().mockResolvedValue(undefined),
    findAuthCodeByHash: vi.fn().mockResolvedValue(null),
    consumeAuthCode: vi.fn().mockResolvedValue(true),
    revokeAllGrantsForClient: vi.fn().mockResolvedValue({ count: 0 }),
    createGrant: vi.fn().mockResolvedValue({ id: 'grant-new' }),
    findGrantByRefreshHash: vi.fn().mockResolvedValue(null),
    revokeGrant: vi.fn().mockResolvedValue(undefined),
    listUserGrants: vi.fn().mockResolvedValue([]),
    findGrantStatusById: vi.fn().mockResolvedValue(null),
    ...repoOverrides,
  };
  const config = {
    get: vi.fn((key: string, def: unknown) => (key in configMap ? configMap[key] : def)),
  };
  const audit = { log: vi.fn() };
  const service = new OAuthService(
    repo as unknown as OAuthRepository,
    config as unknown as import('@nestjs/config').ConfigService,
    audit as unknown as import('../audit/audit.service').AuditService,
  );
  return { service, repo, audit };
}

describe('OAuthService.registerClient', () => {
  let service: OAuthService;
  let repo: RepoMock;

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

// ── Authorize / Consent ───────────────────────────────────────────────

const VALID_AUTHORIZE = {
  response_type: 'code',
  client_id: 'klar_mcp_abc',
  redirect_uri: 'http://localhost:33418/cb',
  scope: 'klar:transactions:read klar:overview:read',
  state: 'st-1',
  code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  code_challenge_method: 'S256',
};

function clientFixture(redirectUris = ['http://localhost:33418/cb']): Record<string, unknown> {
  return {
    clientId: 'klar_mcp_abc',
    clientName: 'Test Client',
    logoUri: null,
    clientUri: null,
    tosUri: null,
    policyUri: null,
    redirectUris,
    disabled: false,
    tokenEndpointAuthMethod: 'none',
    clientSecretHash: null,
  };
}

describe('OAuthService.describeAuthorizeRequest', () => {
  it('describes the request, autoApprove=false on first visit', async () => {
    const { service } = makeService({
      findClientByClientId: vi.fn().mockResolvedValue(clientFixture()),
      findConsent: vi.fn().mockResolvedValue(null),
    });
    const info = await service.describeAuthorizeRequest(VALID_AUTHORIZE, 'user-1');
    expect(info.client.clientId).toBe('klar_mcp_abc');
    expect(info.scopes).toHaveLength(2);
    expect(info.autoApprove).toBe(false);
  });

  it('autoApprove=true if existing consent covers requested scopes', async () => {
    const { service } = makeService({
      findClientByClientId: vi.fn().mockResolvedValue(clientFixture()),
      findConsent: vi.fn().mockResolvedValue({
        scopes: ['klar:transactions:read', 'klar:overview:read', 'klar:categories:read'],
      }),
    });
    const info = await service.describeAuthorizeRequest(VALID_AUTHORIZE, 'user-1');
    expect(info.autoApprove).toBe(true);
  });

  it('rejects unknown client', async () => {
    const { service } = makeService({
      findClientByClientId: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.describeAuthorizeRequest(VALID_AUTHORIZE, 'user-1'),
    ).rejects.toThrow(OAuthError);
  });

  it('rejects redirect_uri not in client whitelist', async () => {
    const { service } = makeService({
      findClientByClientId: vi.fn().mockResolvedValue(clientFixture(['http://other/cb'])),
    });
    await expect(
      service.describeAuthorizeRequest(VALID_AUTHORIZE, 'user-1'),
    ).rejects.toThrow(OAuthError);
  });

  it('rejects plain PKCE method via schema', async () => {
    const { service } = makeService({
      findClientByClientId: vi.fn().mockResolvedValue(clientFixture()),
    });
    await expect(
      service.describeAuthorizeRequest(
        { ...VALID_AUTHORIZE, code_challenge_method: 'plain' },
        'user-1',
      ),
    ).rejects.toThrow(OAuthError);
  });
});

describe('OAuthService.decideConsent', () => {
  const USER = { userId: 'user-1', householdId: 'hh-1' };

  it('approves and returns redirect URL with code+state', async () => {
    const { service, repo } = makeService(
      {
        findClientByClientId: vi.fn().mockResolvedValue(clientFixture()),
      },
      { 'oauth.authCodeTtlSeconds': 60 },
    );

    const res = await service.decideConsent(
      { ...VALID_AUTHORIZE, approve: true },
      USER,
    );
    const url = new URL(res.redirectUrl);
    expect(url.searchParams.get('code')).toBeTruthy();
    expect(url.searchParams.get('state')).toBe('st-1');
    expect(repo.upsertConsent).toHaveBeenCalledWith(
      'user-1',
      'klar_mcp_abc',
      ['klar:transactions:read', 'klar:overview:read'],
    );
    expect(repo.createAuthCode).toHaveBeenCalledOnce();
  });

  it('denies and returns redirect URL with error=access_denied', async () => {
    const { service, repo } = makeService({
      findClientByClientId: vi.fn().mockResolvedValue(clientFixture()),
    });

    const res = await service.decideConsent(
      { ...VALID_AUTHORIZE, approve: false },
      USER,
    );
    const url = new URL(res.redirectUrl);
    expect(url.searchParams.get('error')).toBe('access_denied');
    expect(url.searchParams.get('state')).toBe('st-1');
    expect(repo.createAuthCode).not.toHaveBeenCalled();
  });

  it('merges new scopes with existing consent', async () => {
    const { service, repo } = makeService({
      findClientByClientId: vi.fn().mockResolvedValue(clientFixture()),
      findConsent: vi.fn().mockResolvedValue({
        scopes: ['klar:projects:read'],
      }),
    });

    await service.decideConsent({ ...VALID_AUTHORIZE, approve: true }, USER);
    const args = repo.upsertConsent.mock.calls[0];
    expect(new Set(args[2] as string[])).toEqual(
      new Set(['klar:projects:read', 'klar:transactions:read', 'klar:overview:read']),
    );
  });

  it('rejects when client unknown', async () => {
    const { service } = makeService({
      findClientByClientId: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.decideConsent({ ...VALID_AUTHORIZE, approve: true }, USER),
    ).rejects.toThrow(OAuthError);
  });
});

describe('OAuthService.validateAuthorizeForRedirect', () => {
  it('returns null for valid query (caller proceeds)', () => {
    const { service } = makeService();
    expect(service.validateAuthorizeForRedirect(VALID_AUTHORIZE)).toEqual({ redirectUrl: null });
  });

  it('redirects with error=invalid_request for bad PKCE method', () => {
    const { service } = makeService();
    const { redirectUrl } = service.validateAuthorizeForRedirect({
      ...VALID_AUTHORIZE,
      code_challenge_method: 'plain',
    });
    expect(redirectUrl).toBeTruthy();
    const u = new URL(redirectUrl as string);
    expect(u.searchParams.get('error')).toBe('invalid_request');
    expect(u.searchParams.get('state')).toBe('st-1');
  });

  it('returns invalid_scope error for unknown scope', () => {
    const { service } = makeService();
    const { redirectUrl } = service.validateAuthorizeForRedirect({
      ...VALID_AUTHORIZE,
      scope: 'klar:bogus:read',
    });
    const u = new URL(redirectUrl as string);
    expect(u.searchParams.get('error')).toBe('invalid_scope');
  });
});

// ── Token Endpoint (refresh + replay paths) ──────────────────────────

import * as path from 'path';

const MCP_PRIVATE_KEY = path.resolve(__dirname, '../../keys/mcp.private.pem');

describe('OAuthService.issueToken — refresh_token grant', () => {
  it('rotates the grant and revokes the old one', async () => {
    const { service, repo } = makeService(
      {
        findClientByClientId: vi.fn().mockResolvedValue(clientFixture()),
        findGrantByRefreshHash: vi.fn().mockResolvedValue({
          id: 'grant-old',
          clientId: 'klar_mcp_abc',
          userId: 'user-1',
          householdId: 'hh-1',
          scopes: ['klar:transactions:read'],
          revokedAt: null,
          refreshExpiresAt: new Date(Date.now() + 86_400_000),
        }),
        createGrant: vi.fn().mockResolvedValue({ id: 'grant-new' }),
      },
      {
        'oauth.refreshTokenTtlSeconds': 100,
        'oauth.accessTokenTtlSeconds': 100,
        'oauth.mcpPrivateKeyPath': MCP_PRIVATE_KEY,
        'oauth.mcpAudience': 'klar-mcp',
        'app.baseUrl': 'https://klar.test',
      },
    );

    const res = await service.issueToken({
      grant_type: 'refresh_token',
      refresh_token: 'klar_rt_xxx',
      client_id: 'klar_mcp_abc',
    });

    expect(res.access_token).toBeTruthy();
    expect(res.refresh_token).toMatch(/^klar_rt_/);
    expect(repo.revokeGrant).toHaveBeenCalledWith('grant-old');
    expect(repo.createGrant).toHaveBeenCalledOnce();
  });

  it('rejects revoked refresh_token', async () => {
    const { service } = makeService({
      findClientByClientId: vi.fn().mockResolvedValue(clientFixture()),
      findGrantByRefreshHash: vi.fn().mockResolvedValue({
        id: 'g-1',
        clientId: 'klar_mcp_abc',
        revokedAt: new Date(),
        refreshExpiresAt: new Date(Date.now() + 86_400_000),
        scopes: ['klar:transactions:read'],
      }),
    });
    await expect(
      service.issueToken({
        grant_type: 'refresh_token',
        refresh_token: 'klar_rt_xxx',
        client_id: 'klar_mcp_abc',
      }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });

  it('rejects scope expansion beyond granted', async () => {
    const { service } = makeService({
      findClientByClientId: vi.fn().mockResolvedValue(clientFixture()),
      findGrantByRefreshHash: vi.fn().mockResolvedValue({
        id: 'g-1',
        clientId: 'klar_mcp_abc',
        userId: 'user-1',
        householdId: 'hh-1',
        scopes: ['klar:transactions:read'],
        revokedAt: null,
        refreshExpiresAt: new Date(Date.now() + 86_400_000),
      }),
    });
    await expect(
      service.issueToken({
        grant_type: 'refresh_token',
        refresh_token: 'klar_rt_xxx',
        client_id: 'klar_mcp_abc',
        scope: 'klar:transactions:write',
      }),
    ).rejects.toMatchObject({ code: 'invalid_scope' });
  });

  it('rejects mismatched client_id', async () => {
    const { service } = makeService({
      findClientByClientId: vi.fn().mockResolvedValue(clientFixture()),
      findGrantByRefreshHash: vi.fn().mockResolvedValue({
        id: 'g-1',
        clientId: 'klar_mcp_other',
        revokedAt: null,
        refreshExpiresAt: new Date(Date.now() + 86_400_000),
        scopes: ['klar:transactions:read'],
      }),
    });
    await expect(
      service.issueToken({
        grant_type: 'refresh_token',
        refresh_token: 'klar_rt_xxx',
        client_id: 'klar_mcp_abc',
      }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });
});

describe('OAuthService.issueToken — authorization_code replay', () => {
  it('triggers cascade-revoke when code was already consumed', async () => {
    const { service, repo } = makeService({
      findClientByClientId: vi.fn().mockResolvedValue(clientFixture()),
      findAuthCodeByHash: vi.fn().mockResolvedValue({
        clientId: 'klar_mcp_abc',
        userId: 'user-1',
        householdId: 'hh-1',
        scopes: ['klar:transactions:read'],
        redirectUri: 'http://localhost:33418/cb',
        codeChallenge: 'whatever',
        codeChallengeMethod: 'S256',
        expiresAt: new Date(Date.now() + 60_000),
        consumedAt: new Date(),
      }),
    });
    await expect(
      service.issueToken({
        grant_type: 'authorization_code',
        code: 'CODE',
        redirect_uri: 'http://localhost:33418/cb',
        client_id: 'klar_mcp_abc',
        code_verifier: 'a'.repeat(64),
      }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
    expect(repo.revokeAllGrantsForClient).toHaveBeenCalledWith('klar_mcp_abc');
  });

  it('rejects expired authorization_code', async () => {
    const { service } = makeService({
      findClientByClientId: vi.fn().mockResolvedValue(clientFixture()),
      findAuthCodeByHash: vi.fn().mockResolvedValue({
        clientId: 'klar_mcp_abc',
        userId: 'user-1',
        householdId: 'hh-1',
        scopes: ['klar:transactions:read'],
        redirectUri: 'http://localhost:33418/cb',
        codeChallenge: 'whatever',
        codeChallengeMethod: 'S256',
        expiresAt: new Date(Date.now() - 1000),
        consumedAt: null,
      }),
    });
    await expect(
      service.issueToken({
        grant_type: 'authorization_code',
        code: 'CODE',
        redirect_uri: 'http://localhost:33418/cb',
        client_id: 'klar_mcp_abc',
        code_verifier: 'a'.repeat(64),
      }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });
});

// ── User-Grant Management ─────────────────────────────────────────────

describe('OAuthService user grants', () => {
  it('listUserGrants flattens client info', async () => {
    const { service } = makeService({
      listUserGrants: vi.fn().mockResolvedValue([
        {
          id: 'g-1',
          clientId: 'klar_mcp_abc',
          scopes: ['klar:transactions:read'],
          createdAt: new Date('2026-05-01'),
          lastUsedAt: null,
          refreshExpiresAt: new Date('2026-06-01'),
          client: { clientName: 'Claude Desktop', logoUri: null },
        },
      ]),
    });

    const res = await service.listUserGrants('user-1');
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      id: 'g-1',
      clientId: 'klar_mcp_abc',
      clientName: 'Claude Desktop',
      scopes: ['klar:transactions:read'],
    });
  });

  it('revokeUserGrant rejects unknown grant', async () => {
    const { service } = makeService({
      findGrantStatusById: vi.fn().mockResolvedValue(null),
    });
    await expect(service.revokeUserGrant('user-1', 'missing')).rejects.toThrow(OAuthError);
  });

  it('revokeUserGrant is idempotent on already-revoked', async () => {
    const { service, repo } = makeService({
      findGrantStatusById: vi.fn().mockResolvedValue({ revokedAt: new Date() }),
    });
    await expect(service.revokeUserGrant('user-1', 'g-1')).resolves.toBeUndefined();
    expect(repo.revokeGrant).not.toHaveBeenCalled();
  });

  it('revokeUserGrant rejects grants of other users', async () => {
    const { service } = makeService({
      findGrantStatusById: vi.fn().mockResolvedValue({ revokedAt: null }),
      listUserGrants: vi.fn().mockResolvedValue([]),
    });
    await expect(service.revokeUserGrant('user-1', 'g-other')).rejects.toThrow(OAuthError);
  });

  it('revokeUserGrant calls revokeGrant + audit on success', async () => {
    const { service, repo, audit } = makeService({
      findGrantStatusById: vi.fn().mockResolvedValue({ revokedAt: null }),
      listUserGrants: vi.fn().mockResolvedValue([
        { id: 'g-1', clientId: 'klar_mcp_abc', client: { clientName: 'X' } },
      ]),
    });
    await service.revokeUserGrant('user-1', 'g-1');
    expect(repo.revokeGrant).toHaveBeenCalledWith('g-1');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'oauth.grant.revoked', userId: 'user-1' }),
    );
  });
});

// ── Token Revocation (RFC 7009) ───────────────────────────────────────

describe('OAuthService.revokeToken', () => {
  it('silently ignores empty/missing token', async () => {
    const { service, repo } = makeService();
    await expect(service.revokeToken({})).resolves.toBeUndefined();
    await expect(service.revokeToken({ token: '' })).resolves.toBeUndefined();
    await expect(service.revokeToken(null)).resolves.toBeUndefined();
    expect(repo.revokeGrant).not.toHaveBeenCalled();
  });

  it('silently ignores unknown token', async () => {
    const { service, repo } = makeService({
      findGrantByRefreshHash: vi.fn().mockResolvedValue(null),
    });
    await service.revokeToken({ token: 'klar_rt_unknown' });
    expect(repo.revokeGrant).not.toHaveBeenCalled();
  });

  it('revokes a known refresh-token', async () => {
    const { service, repo } = makeService({
      findGrantByRefreshHash: vi.fn().mockResolvedValue({ id: 'g-1', revokedAt: null }),
    });
    await service.revokeToken({ token: 'klar_rt_xxx' });
    expect(repo.revokeGrant).toHaveBeenCalledWith('g-1');
  });

  it('does nothing for already-revoked grant', async () => {
    const { service, repo } = makeService({
      findGrantByRefreshHash: vi.fn().mockResolvedValue({ id: 'g-1', revokedAt: new Date() }),
    });
    await service.revokeToken({ token: 'klar_rt_xxx' });
    expect(repo.revokeGrant).not.toHaveBeenCalled();
  });
});
