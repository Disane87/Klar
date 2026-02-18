import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Extracts the authenticated User entity from the request. */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
