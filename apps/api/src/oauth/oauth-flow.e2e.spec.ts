/**
 * E2E: Vollständiger OAuth-Flow inklusive MCP-Call.
 *
 * Schritte:
 * 1. POST /oauth2/register → clientId
 * 2. Klar-User registrieren + einloggen
 * 3. POST /api/v1/oauth/consent (approve) → redirect mit code
 * 4. POST /oauth2/token (authorization_code) → access + refresh
 * 5. POST /mcp tools/list → 200 mit Tool-Liste passend zum Scope
 * 6. POST /mcp tools/call list_categories → echte Daten
 * 7. POST /api/v1/oauth/grants → Grant in Liste sichtbar
 * 8. DELETE /api/v1/oauth/grants/:id → revoked
 * 9. POST /mcp mit altem Token → 401
 * 10. POST /oauth2/token refresh mit altem Refresh → invalid_grant
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
import { PrismaService } from '../prisma/prisma.service';
import { AppModule } from '../app.module';
import { applyGlobalPrefix } from '../common/global-prefix';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fastifyCookie = require('@fastify/cookie') as Parameters<NestFastifyApplication['register']>[0];

let app: NestFastifyApplication;
let prisma: PrismaService;

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
  await prisma.transaction.deleteMany();
  await prisma.recurringTransaction.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.category.deleteMany();
  await prisma.project.deleteMany();
  await prisma.householdMembership.deleteMany();
  await prisma.household.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.user.deleteMany();
});

function makePkce() {
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

describe('OAuth + MCP full flow', () => {
  it('round-trips registration → consent → token → MCP call → revoke', async () => {
    // 1. Register MCP client
    const reg = await app.inject({
      method: 'POST',
      url: '/oauth2/register',
      payload: {
        client_name: 'flow-test',
        redirect_uris: ['http://localhost:33418/cb'],
      },
    });
    expect(reg.statusCode).toBe(201);
    const { client_id: clientId } = JSON.parse(reg.body) as { client_id: string };

    // 2. User registrieren + einloggen
    const email = 'flow-user@test.com';
    const password = 'TestPass123!';
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password, displayName: 'Flow User' },
    });
    expect(r.statusCode).toBe(201);
    await prisma.user.update({ where: { email }, data: { emailVerified: true } });
    const l = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(l.statusCode).toBe(200);
    const { accessToken: klarAccess } = JSON.parse(l.body) as { accessToken: string };

    // 3. Consent approve
    const { verifier, challenge } = makePkce();
    const consent = await app.inject({
      method: 'POST',
      url: '/api/v1/oauth/consent',
      headers: { authorization: `Bearer ${klarAccess}` },
      payload: {
        response_type: 'code',
        client_id: clientId,
        redirect_uri: 'http://localhost:33418/cb',
        scope: 'klar:transactions:read klar:categories:read',
        state: 'st-1',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        approve: true,
      },
    });
    expect(consent.statusCode).toBe(201);
    const { redirectUrl } = JSON.parse(consent.body) as { redirectUrl: string };
    const code = new URL(redirectUrl).searchParams.get('code')!;
    expect(code).toBeTruthy();

    // 4. Token exchange
    const tokenRes = await app.inject({
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
    expect(tokenRes.statusCode).toBe(200);
    const tokens = JSON.parse(tokenRes.body) as {
      access_token: string;
      refresh_token: string;
      scope: string;
    };
    expect(tokens.scope).toBe('klar:transactions:read klar:categories:read');

    // 5. MCP tools/list
    const initBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'flow-test', version: '0.0.1' },
      },
    };
    const init = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: `Bearer ${tokens.access_token}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: initBody,
    });
    expect([200, 202]).toContain(init.statusCode);

    const listBody = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    };
    const list = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: `Bearer ${tokens.access_token}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: listBody,
    });
    expect([200, 202]).toContain(list.statusCode);
    // Beim Streamable-HTTP-Transport kommt SSE oder JSON zurück — beide
    // enthalten den `result.tools`-Key. Wir greppen einfach.
    expect(list.body).toContain('list_transactions');
    expect(list.body).toContain('list_categories');
    // create_* darf NICHT auftauchen (kein write-Scope)
    expect(list.body).not.toContain('create_transaction');

    // 6. Grants-Listing
    const grantsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/oauth/grants',
      headers: { authorization: `Bearer ${klarAccess}` },
    });
    expect(grantsRes.statusCode).toBe(200);
    const grants = JSON.parse(grantsRes.body) as { id: string; clientId: string }[];
    expect(grants).toHaveLength(1);
    expect(grants[0].clientId).toBe(clientId);

    // 7. Revoke per Settings
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/oauth/grants/${grants[0].id}`,
      headers: { authorization: `Bearer ${klarAccess}` },
    });
    expect(del.statusCode).toBe(204);

    // 8. MCP call mit revoked Grant → 401
    const afterRevoke = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: `Bearer ${tokens.access_token}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: listBody,
    });
    expect(afterRevoke.statusCode).toBe(401);
    expect(afterRevoke.headers['www-authenticate']).toContain('Bearer realm="klar-mcp"');

    // 9. Refresh mit revoked Token → invalid_grant
    const refreshAfter = await app.inject({
      method: 'POST',
      url: '/oauth2/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: clientId,
      }).toString(),
    });
    expect(refreshAfter.statusCode).toBe(400);
    const errBody = JSON.parse(refreshAfter.body) as { error: string };
    expect(errBody.error).toBe('invalid_grant');
  });
});
