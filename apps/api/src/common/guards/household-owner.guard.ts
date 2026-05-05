import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { HouseholdRole } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import type { JwtPayload } from '../types/jwt-payload.type';
import type { RequestContext } from '../types/request-context.type';
import { HouseholdsRepository } from '../../households/households.repository';

@Injectable()
export class HouseholdOwnerGuard implements CanActivate {
  constructor(private readonly householdsRepo: HouseholdsRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      FastifyRequest & { user: JwtPayload; reqContext: RequestContext; params: Record<string, string> }
    >();

    const householdId = req.params['hid'];
    if (!householdId) throw new ForbiddenException('Haushalt-ID fehlt');

    const userId = req.user.sub;
    const membership = await this.householdsRepo.findMembership(userId, householdId);
    if (!membership) {
      throw new ForbiddenException('Kein Mitglied dieses Haushalts');
    }
    if (membership.role !== HouseholdRole.OWNER) {
      throw new ForbiddenException('Nur Haushalts-Eigentümer dürfen diese Aktion ausführen');
    }

    req.reqContext = { userId, householdId, source: 'web' };
    return true;
  }
}
