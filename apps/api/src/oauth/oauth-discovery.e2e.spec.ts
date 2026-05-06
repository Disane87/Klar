/**
 * E2E: OAuth Discovery (RFC 8414, RFC 9728)
 *
 * Stellt sicher, dass die Well-Known-Endpoints am Domain-Root erreichbar sind
 * (NICHT unter /api/v1/) und konforme JSON-Metadata zurückgeben.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../app.module';
import { applyGlobalPrefix } from '../common/global-prefix';
import { OAUTH_SCOPES } from '@klar/shared';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fastifyCookie = require('@fastify/cookie') as Parameters<NestFastifyApplication['register']>[0];

let app: NestFastifyApplication;

beforeAll(async () => {
  process.env['DATABASE_URL'] = process.env['DATABASE_TEST_URL'] ?? process.env['DATABASE_URL'];
  process.env['APP_BASE_URL'] = 'https://klar.test';

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  );

  await app.register(fastifyCookie);
  applyGlobalPrefix(app);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /.well-known/oauth-authorization-server', () => {
  it('returns authorization server metadata at domain root', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/.well-known/oauth-authorization-server',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;

    expect(body['issuer']).toBe('https://klar.test');
    expect(body['authorization_endpoint']).toBe('https://klar.test/oauth2/authorize');
    expect(body['token_endpoint']).toBe('https://klar.test/oauth2/token');
    expect(body['registration_endpoint']).toBe('https://klar.test/oauth2/register');
    expect(body['revocation_endpoint']).toBe('https://klar.test/oauth2/revoke');
    expect(body['response_types_supported']).toEqual(['code']);
    expect(body['grant_types_supported']).toEqual(['authorization_code', 'refresh_token']);
    expect(body['code_challenge_methods_supported']).toEqual(['S256']);
    expect(body['scopes_supported']).toEqual([...OAUTH_SCOPES]);
  });

  it('is NOT reachable under /api/v1 prefix', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/.well-known/oauth-authorization-server',
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /.well-known/oauth-protected-resource', () => {
  it('returns resource metadata pointing to /mcp', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/.well-known/oauth-protected-resource',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;

    expect(body['resource']).toBe('https://klar.test/mcp');
    expect(body['authorization_servers']).toEqual(['https://klar.test']);
    expect(body['bearer_methods_supported']).toEqual(['header']);
    expect(body['scopes_supported']).toEqual([...OAUTH_SCOPES]);
  });
});
