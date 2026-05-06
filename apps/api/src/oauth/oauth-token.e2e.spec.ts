/**
 * E2E: POST /oauth2/token (Authorization Code + Refresh Token grants).
 * Verifiziert kompletten Code → Token → Refresh-Rotation Flow inkl. PKCE
 * und Replay-Detection.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { AppModule } from '../app.module';
import { applyGlobalPrefix } from '../common/global-prefix';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fastifyCookie = require('@fastify/cookie') as Parameters<NestFastifyApplication['register']>[0];

let app: NestFastifyApplication;
let prisma: PrismaService;

interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface ConsentResponse {
  redirectUrl: string;
}

function makePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString('base64url').slice(0, 64);
  const challenge = createHash('sha256')
    .update(verifier)
    .digest()
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return { verifier, challenge };
}

async function registerAndLogin(email: string): Promise<string> {
  const password = 'TestPass123!';
  const r = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password, displayName: 'Test User' },
  });
  if (r.statusCode !== 201) throw new Error(`register: ${r.body}`);
  await prisma.user.update({ where: { email }, data: { emailVerified: true } });
  const l = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });
  if (l.statusCode !== 200) throw new Error(`login: ${l.body}`);
  return (JSON.parse(l.body) as { accessToken: string }).accessToken;
}

async function registerClient(redirectUri = 'http://localhost:33418/cb'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/oauth2/register',
    payload: { client_name: 'token-test', redirect_uris: [redirectUri] },
  });
  if (res.statusCode !== 201) throw new Error(`register-client: ${res.body}`);
  return (JSON.parse(res.body) as { client_id: string }).client_id;
}

async function getAuthCode(opts: {
  accessToken: string;
  clientId: string;
  redirectUri: string;
  challenge: string;
  scope: string;
}): Promise<string> {
  const body = {
    response_type: 'code',
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: opts.scope,
    state: 'st',
    code_challenge: opts.challenge,
    code_challenge_method: 'S256',
    approve: true,
  };
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/oauth/consent',
    headers: { authorization: `Bearer ${opts.accessToken}` },
    payload: body,
  });
  if (res.statusCode !== 201) throw new Error(`consent: ${res.body}`);
  const { redirectUrl } = JSON.parse(res.body) as ConsentResponse;
  return new URL(redirectUrl).searchParams.get('code')!;
}

beforeAll(async () => {
  process.env['DATABASE_URL'] = process.env['DATABASE_TEST_URL'] ?? process.env['DATABASE_URL'];
  process.env['APP_BASE_URL'] = 'https://klar.test';
  process.env['FRONTEND_URL'] = 'https://app.klar.test';

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  );
  await app.register(fastifyCookie);
  applyGlobalPrefix(app);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

afterEach(async () => {
  await prisma.oAuthAuthCode.deleteMany();
  await prisma.oAuthGrant.deleteMany();
  await prisma.oAuthConsent.deleteMany();
  await prisma.oAuthClient.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.householdMembership.deleteMany();
  await prisma.household.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.user.deleteMany();
});

describe('POST /oauth2/token (authorization_code)', () => {
  it('exchanges a valid code+verifier for access+refresh tokens', async () => {
    const accessToken = await registerAndLogin('alice-token@test.com');
    const clientId = await registerClient();
    const { verifier, challenge } = makePkce();
    const code = await getAuthCode({
      accessToken,
      clientId,
      redirectUri: 'http://localhost:33418/cb',
      challenge,
      scope: 'klar:transactions:read',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/oauth2/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:33418/cb',
        client_id: clientId,
        code_verifier: verifier,
      }).toString(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const body = JSON.parse(res.body) as TokenResponse;
    expect(body.token_type).toBe('Bearer');
    expect(body.expires_in).toBeGreaterThan(0);
    expect(body.refresh_token).toMatch(/^klar_rt_/);
    expect(body.scope).toBe('klar:transactions:read');

    // JWT validieren
    const publicKey = fs.readFileSync(process.env['JWT_MCP_PUBLIC_KEY_PATH']!);
    const decoded = jwt.verify(body.access_token, publicKey, {
      algorithms: ['RS256'],
      audience: 'klar-mcp',
    }) as Record<string, unknown>;
    expect(decoded['azp']).toBe(clientId);
    expect(decoded['scope']).toBe('klar:transactions:read');
    expect(decoded['hh']).toBeTruthy();
  });

  it('rejects re-using a consumed code and revokes all client grants', async () => {
    const accessToken = await registerAndLogin('bob-token@test.com');
    const clientId = await registerClient();
    const { verifier, challenge } = makePkce();
    const code = await getAuthCode({
      accessToken,
      clientId,
      redirectUri: 'http://localhost:33418/cb',
      challenge,
      scope: 'klar:transactions:read',
    });

    const first = await app.inject({
      method: 'POST',
      url: '/oauth2/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:33418/cb',
        client_id: clientId,
        code_verifier: verifier,
      }).toString(),
    });
    expect(first.statusCode).toBe(200);

    const replay = await app.inject({
      method: 'POST',
      url: '/oauth2/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:33418/cb',
        client_id: clientId,
        code_verifier: verifier,
      }).toString(),
    });
    expect(replay.statusCode).toBe(400);
    const errBody = JSON.parse(replay.body) as { error: string };
    expect(errBody.error).toBe('invalid_grant');

    // Cascade-Revoke: alle Grants des Clients sind revoked
    const grants = await prisma.oAuthGrant.findMany({ where: { clientId } });
    expect(grants.every((g) => g.revokedAt !== null)).toBe(true);
  });

  it('rejects bad PKCE verifier', async () => {
    const accessToken = await registerAndLogin('carol-token@test.com');
    const clientId = await registerClient();
    const { challenge } = makePkce();
    const code = await getAuthCode({
      accessToken,
      clientId,
      redirectUri: 'http://localhost:33418/cb',
      challenge,
      scope: 'klar:transactions:read',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/oauth2/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:33418/cb',
        client_id: clientId,
        code_verifier: 'a'.repeat(64),
      }).toString(),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toBe('invalid_grant');
  });

  it('rejects mismatched redirect_uri', async () => {
    const accessToken = await registerAndLogin('dave-token@test.com');
    const clientId = await registerClient();
    const { verifier, challenge } = makePkce();
    const code = await getAuthCode({
      accessToken,
      clientId,
      redirectUri: 'http://localhost:33418/cb',
      challenge,
      scope: 'klar:transactions:read',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/oauth2/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:33418/different',
        client_id: clientId,
        code_verifier: verifier,
      }).toString(),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toBe('invalid_grant');
  });
});

describe('POST /oauth2/token (refresh_token)', () => {
  async function getInitialTokens(email: string): Promise<{ refresh: string; clientId: string }> {
    const accessToken = await registerAndLogin(email);
    const clientId = await registerClient();
    const { verifier, challenge } = makePkce();
    const code = await getAuthCode({
      accessToken,
      clientId,
      redirectUri: 'http://localhost:33418/cb',
      challenge,
      scope: 'klar:transactions:read klar:overview:read',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/oauth2/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:33418/cb',
        client_id: clientId,
        code_verifier: verifier,
      }).toString(),
    });
    const body = JSON.parse(res.body) as TokenResponse;
    return { refresh: body.refresh_token, clientId };
  }

  it('rotates refresh token and revokes the old one', async () => {
    const { refresh: oldRt, clientId } = await getInitialTokens('eve-token@test.com');

    const res = await app.inject({
      method: 'POST',
      url: '/oauth2/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: oldRt,
        client_id: clientId,
      }).toString(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as TokenResponse;
    expect(body.refresh_token).not.toBe(oldRt);

    const replay = await app.inject({
      method: 'POST',
      url: '/oauth2/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: oldRt,
        client_id: clientId,
      }).toString(),
    });
    expect(replay.statusCode).toBe(400);
  });

  it('issues only a subset of granted scopes when requested', async () => {
    const { refresh, clientId } = await getInitialTokens('frank-token@test.com');

    const res = await app.inject({
      method: 'POST',
      url: '/oauth2/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh,
        client_id: clientId,
        scope: 'klar:transactions:read',
      }).toString(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as TokenResponse;
    expect(body.scope).toBe('klar:transactions:read');
  });

  it('rejects scope expansion beyond granted', async () => {
    const { refresh, clientId } = await getInitialTokens('grace-token@test.com');

    const res = await app.inject({
      method: 'POST',
      url: '/oauth2/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh,
        client_id: clientId,
        scope: 'klar:transactions:write',
      }).toString(),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toBe('invalid_scope');
  });
});
