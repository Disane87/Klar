import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AppRole } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import type { JwtPayload } from '../types/jwt-payload.type';

@Injectable()
export class AppAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FastifyRequest & { user: JwtPayload }>();
    if (req.user?.role !== AppRole.ADMIN) {
      throw new ForbiddenException('Admin-Rechte erforderlich');
    }
    return true;
  }
}
