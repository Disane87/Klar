export const API_KEY_SCOPES = [
  'transactions:read',
  'transactions:write',
  'categories:read',
  'overview:read',
  'projects:read',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];
