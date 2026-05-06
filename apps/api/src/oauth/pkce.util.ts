import { createHash } from 'crypto';

/**
 * Verifiziert einen PKCE-S256-Pair (RFC 7636).
 * `challenge` muss BASE64URL(SHA256(verifier)) sein.
 *
 * Wir akzeptieren ausschließlich die S256-Methode — `plain` ist ein verlorener
 * Schutz und in MCP-Spec verboten.
 */
export function verifyS256(verifier: string, challenge: string): boolean {
  if (!verifier || verifier.length < 43 || verifier.length > 128) return false;
  if (!/^[A-Za-z0-9\-._~]+$/.test(verifier)) return false;
  const hash = createHash('sha256').update(verifier).digest();
  const expected = hash
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return timingSafeEqualStr(expected, challenge);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
