import * as jwt from 'jsonwebtoken';

export interface McpAccessTokenClaims {
  iss: string;
  sub: string;          // userId
  aud: string;          // "klar-mcp"
  azp: string;          // clientId
  scope: string;        // space-separated
  hh: string;           // householdId
  jti: string;
  iat: number;
  exp: number;
}

export interface SignTokenInput {
  userId: string;
  householdId: string;
  clientId: string;
  scopes: string[];
  ttlSeconds: number;
  issuer: string;
  audience: string;
  privateKey: Buffer | string;
  jti: string;
}

export function signMcpAccessToken(input: SignTokenInput): { token: string; expiresIn: number } {
  const now = Math.floor(Date.now() / 1000);
  const claims: Omit<McpAccessTokenClaims, 'iat' | 'exp'> = {
    iss: input.issuer,
    sub: input.userId,
    aud: input.audience,
    azp: input.clientId,
    scope: input.scopes.join(' '),
    hh: input.householdId,
    jti: input.jti,
  };
  const token = jwt.sign(claims, input.privateKey, {
    algorithm: 'RS256',
    expiresIn: input.ttlSeconds,
  });
  return { token, expiresIn: input.ttlSeconds };
}

export interface VerifyResult {
  ok: boolean;
  claims?: McpAccessTokenClaims;
  /** Failure category, mapped to OAuth error codes by caller. */
  reason?: 'expired' | 'invalid_signature' | 'wrong_audience' | 'malformed';
}

export function verifyMcpAccessToken(
  token: string,
  publicKey: Buffer | string,
  expectedAudience: string,
  expectedIssuer?: string,
): VerifyResult {
  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      audience: expectedAudience,
      issuer: expectedIssuer,
    }) as McpAccessTokenClaims;
    return { ok: true, claims: decoded };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return { ok: false, reason: 'expired' };
    }
    if (err instanceof jwt.JsonWebTokenError) {
      if (/audience/i.test(err.message)) return { ok: false, reason: 'wrong_audience' };
      return { ok: false, reason: 'invalid_signature' };
    }
    return { ok: false, reason: 'malformed' };
  }
}
