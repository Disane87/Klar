import { RequestMethod } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

/**
 * Setzt den globalen API-Prefix `/api/v1` mit allen Pfaden, die spec-bedingt
 * am Domain-Root leben müssen (Health-Check, OAuth-Discovery, OAuth-Endpoints,
 * MCP). Wird sowohl von main.ts als auch von e2e-Tests verwendet, damit der
 * Routing-Vertrag konsistent bleibt.
 */
export function applyGlobalPrefix(app: NestFastifyApplication): void {
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: '.well-known/oauth-authorization-server', method: RequestMethod.GET },
      { path: '.well-known/oauth-protected-resource', method: RequestMethod.GET },
      { path: 'oauth2/{*path}', method: RequestMethod.ALL },
      { path: 'mcp', method: RequestMethod.ALL },
    ],
  });
}
