import type { AppRole } from '@klar/shared';

export type JwtPayload = {
  sub: string;
  email: string;
  role: AppRole;
  type: 'access';
};
