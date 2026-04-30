import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { RequestContext } from '../types/request-context.type';

export const ReqContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContext => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest & { reqContext: RequestContext }>();
    return request.reqContext;
  },
);
