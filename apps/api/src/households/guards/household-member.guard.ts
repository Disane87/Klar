import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { JwtPayload } from '../../common/types/jwt-payload.type';
import type { RequestContext } from '../../common/types/request-context.type';
import { HouseholdsRepository } from '../households.repository';

@Injectable()
export class HouseholdMemberGuard implements CanActivate {
  constructor(private readonly householdsRepo: HouseholdsRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user: JwtPayload; reqContext: RequestContext; params: Record<string, string> }>();

    const householdId = req.params['hid'];
    if (!householdId) {
      throw new NotFoundException('Haushalt-ID fehlt');
    }

    const userId = req.user.sub;
    const membership = await this.householdsRepo.findMembership(userId, householdId);
    if (!membership) {
      throw new ForbiddenException('Kein Mitglied dieses Haushalts');
    }

    req.reqContext = {
      userId,
      householdId,
      source: 'web',
    };

    return true;
  }
}
