import { SetMetadata } from '@nestjs/common';

export const REQUIRED_SCOPE_KEY = 'required_scope';

export const RequireScope = (scope: string): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRED_SCOPE_KEY, scope);
