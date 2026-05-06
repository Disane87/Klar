export type RequestContext = {
  userId: string;
  householdId: string;
  source: 'web' | 'api-key' | 'mcp';
  apiKeyId?: string;
  /** Bei `source: 'mcp'`: clientId des authorized OAuth Clients (jwt.azp). */
  mcpClientId?: string;
  /** Bei `source: 'mcp'`: gewährte Scopes aus dem Access-Token. */
  scopes?: string[];
  /** Bei `source: 'mcp'`: jti des Access-Tokens (= Grant-ID, für Revocation-Check). */
  grantId?: string;
};
