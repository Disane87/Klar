/**
 * E2E: API-Keys endpoints
 *
 * Tests create, list, revoke, and delete routes against a real test database
 * (DATABASE_TEST_URL).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppModule } from '../app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fastifyCookie = require('@fastify/cookie') as Parameters<NestFastifyApplication['register']>[0];

let app: NestFastifyApplication;
let prisma: PrismaService;

interface AuthTokens { accessToken: string }

async function registerAndLogin(
  email: string,
  password = 'TestPass123!',
  displayName = 'Test User',
): Promise<AuthTokens> {
  const registerRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password, displayName },
  });

  if (registerRes.statusCode !== 201) {
    throw new Error(`Register failed: ${registerRes.body}`);
  }

  await prisma.user.update({
    where: { email },
    data: { emailVerified: true },
  });

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });

  if (loginRes.statusCode !== 200) {
    throw new Error(`Login failed: ${loginRes.body}`);
  }

  return JSON.parse(loginRes.body) as AuthTokens;
}

async function getHouseholdId(accessToken: string): Promise<string> {
  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/households',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const households = JSON.parse(res.body) as { household: { id: string } }[];
  return households[0].household.id;
}

beforeAll(async () => {
  process.env['DATABASE_URL'] = process.env['DATABASE_TEST_URL'] ?? process.env['DATABASE_URL'];

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  );

  await app.register(fastifyCookie);
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

afterEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.recurringTransaction.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.category.deleteMany();
  await prisma.project.deleteMany();
  await prisma.householdMembership.deleteMany();
  await prisma.household.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.user.deleteMany();
});

describe('POST /api/v1/households/:hid/api-keys', () => {
  it('creates an API key and returns fullKey starting with bgb_live_', async () => {
    const { accessToken } = await registerAndLogin('alice-apikey@test.com');
    const householdId = await getHouseholdId(accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/api-keys`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'My Integration', scopes: ['transactions:read'] },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as {
      id: string;
      name: string;
      scopes: string[];
      fullKey: string;
      isRevoked: boolean;
    };
    expect(body.id).toBeDefined();
    expect(body.name).toBe('My Integration');
    expect(body.scopes).toContain('transactions:read');
    expect(body.fullKey).toBeDefined();
    expect(body.fullKey).not.toBeNull();
    expect(body.fullKey).toMatch(/^bgb_live_/);
    expect(body.isRevoked).toBe(false);
  });

  it('rejects empty name with 400', async () => {
    const { accessToken } = await registerAndLogin('alice-apikey2@test.com');
    const householdId = await getHouseholdId(accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/api-keys`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: '', scopes: ['transactions:read'] },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects empty scopes array with 400', async () => {
    const { accessToken } = await registerAndLogin('alice-apikey3@test.com');
    const householdId = await getHouseholdId(accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/api-keys`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'My Integration', scopes: [] },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid scope values with 400', async () => {
    const { accessToken } = await registerAndLogin('alice-apikey4@test.com');
    const householdId = await getHouseholdId(accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/api-keys`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'My Integration', scopes: ['invalid:scope'] },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/v1/households/:hid/api-keys', () => {
  it('lists keys without fullKey — fullKey is null in list response', async () => {
    const { accessToken } = await registerAndLogin('alice-list-keys@test.com');
    const householdId = await getHouseholdId(accessToken);

    // Create a key first
    await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/api-keys`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Integration A', scopes: ['transactions:read'] },
    });

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/api-keys`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(listRes.statusCode).toBe(200);
    const keys = JSON.parse(listRes.body) as { id: string; name: string; fullKey?: string | null }[];
    expect(keys).toHaveLength(1);
    expect(keys[0].name).toBe('Integration A');
    // fullKey must not be present in list — the service only adds it on create
    expect(keys[0].fullKey).toBeUndefined();
  });

  it('returns empty list when no keys exist', async () => {
    const { accessToken } = await registerAndLogin('alice-empty-keys@test.com');
    const householdId = await getHouseholdId(accessToken);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/api-keys`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const keys = JSON.parse(res.body) as unknown[];
    expect(keys).toHaveLength(0);
  });
});

describe('DELETE /api/v1/households/:hid/api-keys/:id/revoke', () => {
  it('revokes an API key and removes it from the list', async () => {
    const { accessToken } = await registerAndLogin('alice-revoke@test.com');
    const householdId = await getHouseholdId(accessToken);

    // Create a key
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/api-keys`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'To Revoke', scopes: ['transactions:read'] },
    });
    const { id } = JSON.parse(createRes.body) as { id: string };

    // Revoke
    const revokeRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/households/${householdId}/api-keys/${id}/revoke`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(revokeRes.statusCode).toBe(204);

    // Revoked keys are filtered from the list (findAll uses isRevoked: false)
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/api-keys`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const keys = JSON.parse(listRes.body) as { id: string; isRevoked: boolean }[];
    expect(keys.find((k) => k.id === id)).toBeUndefined();
  });

  it('returns 404 when revoking a non-existent key', async () => {
    const { accessToken } = await registerAndLogin('alice-revoke2@test.com');
    const householdId = await getHouseholdId(accessToken);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/households/${householdId}/api-keys/non-existent-id/revoke`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/v1/households/:hid/api-keys/:id', () => {
  it('hard-deletes an API key and removes it from the list', async () => {
    const { accessToken } = await registerAndLogin('alice-delete-key@test.com');
    const householdId = await getHouseholdId(accessToken);

    // Create a key
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${householdId}/api-keys`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'To Delete', scopes: ['transactions:read'] },
    });
    const { id } = JSON.parse(createRes.body) as { id: string };

    // Delete
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/households/${householdId}/api-keys/${id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(deleteRes.statusCode).toBe(204);

    // Verify removed from list
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${householdId}/api-keys`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const keys = JSON.parse(listRes.body) as { id: string }[];
    expect(keys.find((k) => k.id === id)).toBeUndefined();
  });

  it('returns 404 when deleting a non-existent key', async () => {
    const { accessToken } = await registerAndLogin('alice-delete-key2@test.com');
    const householdId = await getHouseholdId(accessToken);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/households/${householdId}/api-keys/non-existent-id`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(404);
  });
});
