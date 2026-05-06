import { randomBytes, createHash } from 'crypto';

const CLIENT_ID_PREFIX = 'klar_mcp_';
const REGISTRATION_ACCESS_TOKEN_PREFIX = 'klar_rat_';
const REFRESH_TOKEN_PREFIX = 'klar_rt_';
const CLIENT_SECRET_PREFIX = 'klar_cs_';

/** Returns prefix + N random hex chars (lowercase). */
function withPrefixHex(prefix: string, byteLen: number): string {
  return prefix + randomBytes(byteLen).toString('hex');
}

/** Public client_id like `klar_mcp_<24 hex>`. Safe to log. */
export function generateClientId(): string {
  return withPrefixHex(CLIENT_ID_PREFIX, 12);
}

/** Plain client_secret — issued only once, hashed in DB via Argon2. */
export function generateClientSecret(): string {
  return withPrefixHex(CLIENT_SECRET_PREFIX, 24);
}

/** Plain registration_access_token (RFC 7592) — hashed via SHA-256 in DB. */
export function generateRegistrationAccessToken(): string {
  return withPrefixHex(REGISTRATION_ACCESS_TOKEN_PREFIX, 24);
}

/** Plain refresh-token — hashed via SHA-256 in DB. */
export function generateRefreshToken(): string {
  return withPrefixHex(REFRESH_TOKEN_PREFIX, 24);
}

/** Plain authorization-code — hashed via SHA-256 in DB. */
export function generateAuthorizationCode(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex digest. Used for codes/refresh-tokens (we only need uniqueness lookup). */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
