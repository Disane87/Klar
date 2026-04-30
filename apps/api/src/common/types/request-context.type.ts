export type RequestContext = {
  userId: string;
  householdId: string;
  source: 'web' | 'api-key';
  apiKeyId?: string;
};
