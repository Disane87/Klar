import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { OAuthBearerGuard } from './oauth-bearer.guard';
import type { OAuthRepository } from '../../oauth/oauth.repository';

const apiRoot = path.resolve(__dirname, '../../..');
const privateKeyPath = path.join(apiRoot, 'keys/mcp.private.pem');
const publicKeyPath = path.join(apiRoot, 'keys/mcp.public.pem');

const ISSUER = 'https://klar.test';
const AUDIENCE = 'klar-mcp';

function makeToken(opts: {
  sub?: string;
  aud?: string;
  iss?: string;
  jti?: string;
  expiresIn?: number;
  scope?: string;
  hh?: string;
  azp?: string;
} = {}): string {
  const privateKey = fs.readFileSync(privateKeyPath);
  return jwt.sign(
    {
      sub: opts.sub ?? 'user-1',
      aud: opts.aud ?? AUDIENCE,
      iss: opts.iss ?? ISSUER,
      jti: opts.jti ?? 'grant-1',
      scope: opts.scope ?? 'klar:transactions:read',
      hh: opts.hh ?? 'household-1',
      azp: opts.azp ?? 'klar_mcp_xxx',
    },
    privateKey,
    { algorithm: 'RS256', expiresIn: opts.expiresIn ?? 3600 },
  );
}

function makeContext(authorization?: string): {
  ctx: ExecutionContext;
  req: { headers: Record<string, string>; reqContext?: unknown };
  reply: { header: ReturnType<typeof vi.fn> };
} {
  const req: { headers: Record<string, string>; reqContext?: unknown } = {
    headers: authorization ? { authorization } : {},
  };
  const reply = { header: vi.fn() };
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => reply,
    }),
  } as unknown as ExecutionContext;
  return { ctx, req, reply };
}

function makeGuard(opts?: {
  grantStatus?: { revokedAt: Date | null } | null;
}): OAuthBearerGuard {
  const config = {
    get: vi.fn((key: string, def: unknown) => {
      const map: Record<string, unknown> = {
        'oauth.mcpAudience': AUDIENCE,
        'oauth.mcpPublicKeyPath': publicKeyPath,
        'app.baseUrl': ISSUER,
      };
      return key in map ? map[key] : def;
    }),
  };
  const grantStatus = opts && 'grantStatus' in opts ? opts.grantStatus : { revokedAt: null };
  const repo = {
    findGrantStatusById: vi.fn().mockResolvedValue(grantStatus),
  };
  return new OAuthBearerGuard(
    config as unknown as import('@nestjs/config').ConfigService,
    repo as unknown as OAuthRepository,
  );
}

describe('OAuthBearerGuard', () => {
  beforeEach(() => {
    if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
      throw new Error('MCP keys missing — run `pnpm tsx scripts/generate-mcp-keys.ts` from apps/api/');
    }
  });

  it('accepts a valid bearer token and sets reqContext', async () => {
    const guard = makeGuard();
    const token = makeToken({ jti: 'grant-x' });
    const { ctx, req } = makeContext(`Bearer ${token}`);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    const c = req.reqContext as { source: string; userId: string; householdId: string; mcpClientId: string; scopes: string[]; grantId: string };
    expect(c.source).toBe('mcp');
    expect(c.userId).toBe('user-1');
    expect(c.householdId).toBe('household-1');
    expect(c.mcpClientId).toBe('klar_mcp_xxx');
    expect(c.scopes).toEqual(['klar:transactions:read']);
    expect(c.grantId).toBe('grant-x');
  });

  it('rejects when authorization header is missing', async () => {
    const guard = makeGuard();
    const { ctx, reply } = makeContext();
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(reply.header).toHaveBeenCalledWith(
      'WWW-Authenticate',
      expect.stringContaining('Bearer realm="klar-mcp"'),
    );
  });

  it('rejects token with wrong audience', async () => {
    const guard = makeGuard();
    const token = makeToken({ aud: 'other-aud' });
    const { ctx } = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects expired token', async () => {
    const guard = makeGuard();
    const token = makeToken({ expiresIn: -10 });
    const { ctx } = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects token with revoked grant', async () => {
    const guard = makeGuard({ grantStatus: { revokedAt: new Date() } });
    const token = makeToken();
    const { ctx } = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects token whose grant does not exist', async () => {
    const guard = makeGuard({ grantStatus: null });
    const token = makeToken();
    const { ctx } = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects malformed token', async () => {
    const guard = makeGuard();
    const { ctx } = makeContext('Bearer not-a-valid-jwt');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
