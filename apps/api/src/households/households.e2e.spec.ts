/**
 * E2E: Cross-Tenant Isolation for Households
 *
 * Verifies that a user cannot access another user's household data
 * even with a valid JWT. Uses a real test database (DATABASE_TEST_URL).
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
  app: NestFastifyApplication,
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

  // Bypass email verification for tests
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
  // Clean test data in safe order (cascades handle children)
  await prisma.auditLog.deleteMany();
  await prisma.householdMembership.deleteMany();
  await prisma.household.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.user.deleteMany();
});

describe('GET /api/v1/households', () => {
  it('returns only the households the user belongs to', async () => {
    const { accessToken } = await registerAndLogin(app, 'alice@test.com');
    await registerAndLogin(app, 'bob@test.com');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/households',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const households = JSON.parse(res.body) as { household: { name: string } }[];
    // Alice only sees her own household, not Bob's
    expect(households).toHaveLength(1);
  });
});

describe('Cross-tenant isolation', () => {
  it('returns 403 when accessing another user’s household', async () => {
    const alice = await registerAndLogin(app, 'alice2@test.com');
    const bob = await registerAndLogin(app, 'bob2@test.com');

    // Get Alice's household ID
    const aliceHouseholdsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/households',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    const aliceHouseholds = JSON.parse(aliceHouseholdsRes.body) as { household: { id: string } }[];
    const aliceHouseholdId = aliceHouseholds[0].household.id;

    // Bob tries to access Alice's household
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${aliceHouseholdId}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('Invite code flow', () => {
  it('allows a user to join a household via invite code', async () => {
    const alice = await registerAndLogin(app, 'alice3@test.com');
    await registerAndLogin(app, 'bob3@test.com');

    const bobLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'bob3@test.com', password: 'TestPass123!' },
    });
    const bob = JSON.parse(bobLoginRes.body) as AuthTokens;

    // Get Alice's household
    const aliceHouseholdsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/households',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    const aliceHouseholds = JSON.parse(aliceHouseholdsRes.body) as { household: { id: string } }[];
    const aliceHouseholdId = aliceHouseholds[0].household.id;

    // Alice creates an invite
    const inviteRes = await app.inject({
      method: 'POST',
      url: `/api/v1/households/${aliceHouseholdId}/invites`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {},
    });
    expect(inviteRes.statusCode).toBe(201);
    const invite = JSON.parse(inviteRes.body) as { code: string };

    // Bob joins via invite
    const joinRes = await app.inject({
      method: 'POST',
      url: '/api/v1/households/join',
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { code: invite.code },
    });
    expect(joinRes.statusCode).toBe(200);

    // Bob can now access Alice's household
    const accessRes = await app.inject({
      method: 'GET',
      url: `/api/v1/households/${aliceHouseholdId}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(accessRes.statusCode).toBe(200);
  });
});
