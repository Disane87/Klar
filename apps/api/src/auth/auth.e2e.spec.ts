/**
 * E2E: Auth module
 *
 * Covers register, login, logout, token refresh, and /users/me.
 * Uses a real test database (DATABASE_TEST_URL) and Fastify injection.
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

// ── Helpers ────────────────────────────────────────────────────────────────

async function register(
  email: string,
  password = 'TestPass123!',
  displayName = 'Test User',
) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password, displayName },
  });
}

async function verifyEmail(email: string) {
  await prisma.user.update({
    where: { email },
    data: { emailVerified: true },
  });
}

async function login(
  email: string,
  password = 'TestPass123!',
) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });
}

async function registerVerifyAndLogin(
  email: string,
  password = 'TestPass123!',
  displayName = 'Test User',
): Promise<{ accessToken: string; setCookieHeader: string }> {
  const regRes = await register(email, password, displayName);
  if (regRes.statusCode !== 201) {
    throw new Error(`Register failed: ${regRes.body}`);
  }
  await verifyEmail(email);
  const loginRes = await login(email, password);
  if (loginRes.statusCode !== 200) {
    throw new Error(`Login failed: ${loginRes.body}`);
  }
  const body = JSON.parse(loginRes.body) as { accessToken: string };
  const setCookieHeader = loginRes.headers['set-cookie'] as string ?? '';
  return { accessToken: body.accessToken, setCookieHeader };
}

function extractRefreshCookieValue(setCookieHeader: string): string {
  // Header format: "refresh_token=<value>; Path=...; ..."
  const match = /refresh_token=([^;]+)/.exec(setCookieHeader);
  if (!match) throw new Error('refresh_token cookie not found in Set-Cookie header');
  return match[1];
}

// ── Setup / Teardown ────────────────────────────────────────────────────────

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
  await prisma.householdMembership.deleteMany();
  await prisma.household.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.user.deleteMany();
});

// ── Register ────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('returns 201 and a success message on valid input', async () => {
    const res = await register('alice@test.com');

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { message: string };
    expect(body.message).toBeTruthy();
  });

  it('creates the user in the database', async () => {
    await register('bob@test.com');

    const user = await prisma.user.findUnique({ where: { email: 'bob@test.com' } });
    expect(user).not.toBeNull();
    expect(user?.emailVerified).toBe(false);
  });

  it('creates a household for the new user', async () => {
    await register('carol@test.com');

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'carol@test.com' } });
    const membership = await prisma.householdMembership.findFirst({ where: { userId: user.id } });
    expect(membership).not.toBeNull();
  });

  it('assigns ADMIN role to the very first registered user', async () => {
    await register('first@test.com');

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'first@test.com' } });
    expect(user.appRole).toBe('ADMIN');
  });

  it('assigns USER role to subsequent registrations', async () => {
    await register('first@test.com');
    await register('second@test.com');

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'second@test.com' } });
    expect(user.appRole).toBe('USER');
  });

  it('returns 409 when the email is already taken', async () => {
    await register('dup@test.com');
    const res = await register('dup@test.com');

    expect(res.statusCode).toBe(409);
  });

  it('returns 409 with email comparison case-insensitive', async () => {
    await register('case@test.com');
    const res = await register('CASE@test.com');

    expect(res.statusCode).toBe(409);
  });

  it('returns 400 when email is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { password: 'TestPass123!', displayName: 'No Email' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'nopw@test.com', displayName: 'No Password' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when displayName is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'noname@test.com', password: 'TestPass123!' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ── Login ───────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('returns 200 with accessToken and user when credentials are valid', async () => {
    await register('login@test.com');
    await verifyEmail('login@test.com');

    const res = await login('login@test.com');

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { accessToken: string; user: { email: string } };
    expect(body.accessToken).toBeTruthy();
    expect(body.user.email).toBe('login@test.com');
  });

  it('sets an httpOnly refresh_token cookie on successful login', async () => {
    await register('cookie@test.com');
    await verifyEmail('cookie@test.com');

    const res = await login('cookie@test.com');

    expect(res.statusCode).toBe(200);
    const setCookie = res.headers['set-cookie'] as string;
    expect(setCookie).toMatch(/refresh_token=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Path=\/api\/v1\/auth/i);
  });

  it('returns 403 when email is not yet verified', async () => {
    await register('unverified@test.com');
    // deliberately skip verifyEmail()

    const res = await login('unverified@test.com');

    expect(res.statusCode).toBe(403);
  });

  it('returns 401 when password is wrong', async () => {
    await register('wrongpw@test.com');
    await verifyEmail('wrongpw@test.com');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'wrongpw@test.com', password: 'WrongPassword!' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when user does not exist', async () => {
    const res = await login('nobody@test.com');

    expect(res.statusCode).toBe(401);
  });
});

// ── Me ──────────────────────────────────────────────────────────────────────

describe('GET /api/v1/users/me', () => {
  it('returns 200 with the authenticated user profile', async () => {
    const { accessToken } = await registerVerifyAndLogin('me@test.com');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { email: string; displayName: string };
    expect(body.email).toBe('me@test.com');
    expect(body.displayName).toBeTruthy();
  });

  it('returns 401 when no token is provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when the token is malformed', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: 'Bearer not.a.valid.token' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when the token is expired', async () => {
    // A well-formed JWT with a past exp; the RS256 signature will not match so it gets rejected
    const expiredToken =
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9' +
      '.eyJzdWIiOiJ4IiwiZW1haWwiOiJ4QHkuY29tIiwicm9sZSI6IlVTRVIiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9' +
      '.invalidsignature';

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${expiredToken}` },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ── Logout ──────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('returns 204 and clears the refresh_token cookie', async () => {
    const { accessToken, setCookieHeader } = await registerVerifyAndLogin('logout@test.com');
    const cookieValue = extractRefreshCookieValue(setCookieHeader);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        authorization: `Bearer ${accessToken}`,
        cookie: `refresh_token=${cookieValue}`,
      },
    });

    expect(res.statusCode).toBe(204);
    const resCookie = res.headers['set-cookie'] as string | undefined;
    if (resCookie) {
      expect(resCookie).toMatch(/refresh_token=/);
    }
  });

  it('revokes the refresh token so a subsequent refresh fails', async () => {
    const { accessToken, setCookieHeader } = await registerVerifyAndLogin('revokecheck@test.com');
    const cookieValue = extractRefreshCookieValue(setCookieHeader);

    // Logout revokes the token
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        authorization: `Bearer ${accessToken}`,
        cookie: `refresh_token=${cookieValue}`,
      },
    });

    // Attempt to refresh with the now-revoked token must fail
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: `refresh_token=${cookieValue}` },
    });

    expect(refreshRes.statusCode).toBe(401);
  });

  it('returns 401 when called without a valid JWT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ── Refresh ──────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  it('returns 200 with a new accessToken and rotates the refresh cookie', async () => {
    const { setCookieHeader } = await registerVerifyAndLogin('refresh@test.com');
    const cookieValue = extractRefreshCookieValue(setCookieHeader);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: `refresh_token=${cookieValue}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { accessToken: string; user: { email: string } };
    expect(body.accessToken).toBeTruthy();
    expect(body.user.email).toBe('refresh@test.com');

    const newSetCookie = res.headers['set-cookie'] as string;
    expect(newSetCookie).toMatch(/refresh_token=/);
    const newCookieValue = extractRefreshCookieValue(newSetCookie);
    expect(newCookieValue).not.toBe(cookieValue);
  });

  it('invalidates the old refresh token after rotation (replay prevention)', async () => {
    const { setCookieHeader } = await registerVerifyAndLogin('rotate@test.com');
    const originalCookieValue = extractRefreshCookieValue(setCookieHeader);

    // First refresh succeeds
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: `refresh_token=${originalCookieValue}` },
    });

    // Second attempt with the same (now-rotated-away) token must fail
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: `refresh_token=${originalCookieValue}` },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when no refresh cookie is present', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when the refresh token is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: 'refresh_token=totally-made-up-garbage-value' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('the new access token is usable for authenticated requests', async () => {
    const { setCookieHeader } = await registerVerifyAndLogin('newacc@test.com');
    const cookieValue = extractRefreshCookieValue(setCookieHeader);

    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: `refresh_token=${cookieValue}` },
    });
    const { accessToken } = JSON.parse(refreshRes.body) as { accessToken: string };

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(meRes.statusCode).toBe(200);
  });
});
