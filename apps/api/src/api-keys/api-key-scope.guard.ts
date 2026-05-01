import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { REQUIRED_SCOPE_KEY } from './require-scope.decorator';

@Injectable()
export class ApiKeyScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScope = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRED_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No scope required — allow through
    if (!requiredScope) return true;

    const req = context
      .switchToHttp()
      .getRequest<FastifyRequest & { apiKeyScopes?: string[] }>();

    const scopes = req.apiKeyScopes ?? [];

    if (!scopes.includes(requiredScope)) {
      throw new ForbiddenException(
        `API-Key hat nicht den erforderlichen Scope: ${requiredScope}`,
      );
    }

    return true;
  }
}
