import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { RequestContext } from '../common/types/request-context.type';
import { ApiKeysService } from './api-keys.service';

// Augment FastifyRequest to carry apiKeyScopes alongside reqContext
declare module 'fastify' {
  interface FastifyRequest {
    apiKeyScopes?: string[];
  }
}

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<FastifyRequest & { reqContext: RequestContext; apiKeyScopes?: string[] }>();

    const authHeader = req.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('API-Key fehlt');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Ungültiges Authentifizierungsformat');
    }

    const token = authHeader.slice('Bearer '.length).trim();

    // NEVER log the token
    const result = await this.apiKeysService.verifyKey(token);
    if (!result) {
      throw new UnauthorizedException('Ungültiger oder abgelaufener API-Key');
    }

    // Set reqContext — userId is set to apiKeyId (synthetic, satisfies type)
    req.reqContext = {
      userId: result.apiKeyId,
      householdId: result.householdId,
      source: 'api-key',
      apiKeyId: result.apiKeyId,
    };

    // Attach scopes for ApiKeyScopeGuard
    req.apiKeyScopes = result.scopes;

    return true;
  }
}
