/**
 * E2E: GET /oauth2/authorize + /api/v1/oauth/consent
 *
 * Deckt:
 * - Validierungsfehler → Redirect zur registered redirect_uri mit error/state
 * - Erfolgreicher Validierungs-Flow → Redirect zur Frontend-Consent-Page
 * - Auth-required Consent-Endpoints (GET info, POST decide approve/deny)
 * - Auto-Approve bei Subset bekannter Scopes
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppModule } from '../app.module';
import { applyGlobalPrefix } from '../common/global-prefix';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fastifyCookie = require('@fastify/cookie') as Parameters<NestFastifyApplication['register']>[0];

let app: NestFastifyApplication;
let prisma: PrismaService;

interface RegisterClientResponse {
  client_id: string;
}

interface AuthTokens {
  accessToken: string;
}

async function registerAndLogin(email: string): Promise<{ accessToken: string; userId: string }> {
  const password = 'TestPass123!';
  const r = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password, displayName: 'Test User' },
  });
  if (r.statusCode !== 201) throw new Error(`register failed: ${r.body}`);
  const user = await prisma.user.update({
    where: { email },
    data: { emailVerified: true },
  });
  const l = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });
  if (l.statusCode !== 200) throw new Error(`login failed: ${l.body}`);
  const { accessToken } = JSON.parse(l.body) as AuthTokens;
  return { accessToken, userId: user.id };
}

async function registerClient(redirectUri = 'http://localhost:33418/cb'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/oauth2/register',
    payload: { client_name: 'authorize-test', redirect_uris: [redirectUri] },
  });
  if (res.statusCode !== 201) throw new Error(`register-client failed: ${res.body}`);
  return (JSON.parse(res.body) as RegisterClientResponse).client_id;
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

const VALID_PARAMS = {
  response_type: 'code',
  scope: 'klar:transactions:read klar:overview:read',
  state: 'xyz',
  // 64-char base64url verifier challenge
  code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  code_challenge_method: 'S256',
};

describe('GET /oauth2/authorize', () => {
  it('redirects to frontend consent page on valid request', async () => {
    const clientId = await registerClient();
    const params = new URLSearchParams({
      ...VALID_PARAMS,
      client_id: clientId,
      redirect_uri: 'http://localhost:33418/cb',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/oauth2/authorize?${params.toString()}`,
    });

    expect(res.statusCode).toBe(302);
    const loc = res.headers.location as string;
    expect(loc.startsWith('https://app.klar.test/oauth/consent?')).toBe(true);
    const target = new URL(loc);
    expect(target.searchParams.get('client_id')).toBe(clientId);
    expect(target.searchParams.get('state')).toBe('xyz');
  });

  it('rejects plain PKCE method', async () => {
    const clientId = await registerClient();
    const params = new URLSearchParams({
      ...VALID_PARAMS,
      code_challenge_method: 'plain',
      client_id: clientId,
      redirect_uri: 'http://localhost:33418/cb',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/oauth2/authorize?${params.toString()}`,
    });

    expect(res.statusCode).toBe(302);
    const loc = res.headers.location as string;
    const url = new URL(loc);
    // Goes back to redirect_uri with error code
    expect(url.origin + url.pathname).toBe('http://localhost:33418/cb');
    expect(url.searchParams.get('error')).toBe('invalid_request');
    expect(url.searchParams.get('state')).toBe('xyz');
  });

  it('rejects unsupported response_type', async () => {
    const clientId = await registerClient();
    const params = new URLSearchParams({
      ...VALID_PARAMS,
      response_type: 'token',
      client_id: clientId,
      redirect_uri: 'http://localhost:33418/cb',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/oauth2/authorize?${params.toString()}`,
    });

    const url = new URL(res.headers.location as string);
    expect(url.searchParams.get('error')).toBe('unsupported_response_type');
  });

  it('rejects unknown scope', async () => {
    const clientId = await registerClient();
    const params = new URLSearchParams({
      ...VALID_PARAMS,
      scope: 'klar:bogus:read',
      client_id: clientId,
      redirect_uri: 'http://localhost:33418/cb',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/oauth2/authorize?${params.toString()}`,
    });

    const url = new URL(res.headers.location as string);
    expect(url.searchParams.get('error')).toBe('invalid_scope');
  });
});

describe('GET /api/v1/oauth/consent', () => {
  it('returns client + scope info for the authenticated user', async () => {
    const { accessToken } = await registerAndLogin('alice-consent@test.com');
    const clientId = await registerClient();
    const params = new URLSearchParams({
      ...VALID_PARAMS,
      client_id: clientId,
      redirect_uri: 'http://localhost:33418/cb',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/oauth/consent?${params.toString()}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    const client = body['client'] as Record<string, unknown>;
    expect(client['clientId']).toBe(clientId);
    expect(client['clientName']).toBe('authorize-test');
    expect(body['scopes']).toHaveLength(2);
    expect(body['autoApprove']).toBe(false);
  });

  it('requires authentication', async () => {
    const clientId = await registerClient();
    const params = new URLSearchParams({
      ...VALID_PARAMS,
      client_id: clientId,
      redirect_uri: 'http://localhost:33418/cb',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/oauth/consent?${params.toString()}`,
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/v1/oauth/consent', () => {
  it('approves and returns redirect URL with code+state', async () => {
    const { accessToken } = await registerAndLogin('bob-consent@test.com');
    const clientId = await registerClient();
    const body = {
      ...VALID_PARAMS,
      client_id: clientId,
      redirect_uri: 'http://localhost:33418/cb',
      approve: true,
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/oauth/consent',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: body,
    });

    expect(res.statusCode).toBe(201);
    const { redirectUrl } = JSON.parse(res.body) as { redirectUrl: string };
    const url = new URL(redirectUrl);
    expect(url.origin + url.pathname).toBe('http://localhost:33418/cb');
    expect(url.searchParams.get('code')).toBeTruthy();
    expect(url.searchParams.get('state')).toBe('xyz');
  });

  it('denies and returns redirect URL with error=access_denied', async () => {
    const { accessToken } = await registerAndLogin('eve-consent@test.com');
    const clientId = await registerClient();
    const body = {
      ...VALID_PARAMS,
      client_id: clientId,
      redirect_uri: 'http://localhost:33418/cb',
      approve: false,
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/oauth/consent',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: body,
    });

    expect(res.statusCode).toBe(201);
    const { redirectUrl } = JSON.parse(res.body) as { redirectUrl: string };
    const url = new URL(redirectUrl);
    expect(url.searchParams.get('error')).toBe('access_denied');
    expect(url.searchParams.get('state')).toBe('xyz');
    expect(url.searchParams.get('code')).toBeNull();
  });

  it('persists consent for auto-approve on next call', async () => {
    const { accessToken } = await registerAndLogin('carol-consent@test.com');
    const clientId = await registerClient();
    const body = {
      ...VALID_PARAMS,
      client_id: clientId,
      redirect_uri: 'http://localhost:33418/cb',
      approve: true,
    };

    await app.inject({
      method: 'POST',
      url: '/api/v1/oauth/consent',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: body,
    });

    const params = new URLSearchParams({
      ...VALID_PARAMS,
      client_id: clientId,
      redirect_uri: 'http://localhost:33418/cb',
    });
    const info = await app.inject({
      method: 'GET',
      url: `/api/v1/oauth/consent?${params.toString()}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const infoBody = JSON.parse(info.body) as Record<string, unknown>;
    expect(infoBody['autoApprove']).toBe(true);
  });

  it('rejects unknown client', async () => {
    const { accessToken } = await registerAndLogin('dave-consent@test.com');
    const body = {
      ...VALID_PARAMS,
      client_id: 'klar_mcp_notreal',
      redirect_uri: 'http://localhost:33418/cb',
      approve: true,
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/oauth/consent',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: body,
    });

    expect(res.statusCode).toBe(400);
    const errBody = JSON.parse(res.body) as Record<string, unknown>;
    expect(errBody['error']).toBe('invalid_client');
  });

  it('rejects redirect_uri not registered for client', async () => {
    const { accessToken } = await registerAndLogin('frank-consent@test.com');
    const clientId = await registerClient('http://localhost:33418/cb');
    const body = {
      ...VALID_PARAMS,
      client_id: clientId,
      redirect_uri: 'http://localhost:33418/different',
      approve: true,
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/oauth/consent',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: body,
    });

    expect(res.statusCode).toBe(400);
    const errBody = JSON.parse(res.body) as Record<string, unknown>;
    expect(errBody['error']).toBe('invalid_redirect_uri');
  });
});
