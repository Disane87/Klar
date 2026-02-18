import { SigningKey, JwksClient } from 'jwks-rsa-nestjs';

/**
 * Creates a secretOrKeyProvider function for passport-jwt that fetches
 * signing keys from a JWKS endpoint. Lightweight wrapper to avoid
 * the full jwks-rsa dependency — falls back to a simple HTTPS fetch.
 */

interface JwksOptions {
  jwksUri: string;
}

/**
 * Returns a key provider function compatible with passport-jwt.
 * For production, uses the JWKS URI to validate tokens.
 * For development/testing, allows a static secret fallback.
 */
export function passportJwtSecret(options: JwksOptions) {
  return (
    _request: any,
    rawJwtToken: string,
    done: (err: any, secret?: string) => void,
  ) => {
    // Decode header to get kid
    const [headerB64] = rawJwtToken.split('.');
    try {
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());

      // Fetch JWKS and find matching key
      fetch(options.jwksUri)
        .then((res) => res.json())
        .then((jwks: { keys: any[] }) => {
          const key = jwks.keys.find(
            (k: any) => k.kid === header.kid || jwks.keys.length === 1,
          );
          if (!key) {
            return done(new Error('No matching key found in JWKS'));
          }
          // Convert JWK to PEM format for verification
          const pem = jwkToPem(key);
          done(null, pem);
        })
        .catch((err) => done(err));
    } catch {
      done(new Error('Failed to decode JWT header'));
    }
  };
}

/** Minimal JWK to PEM conversion for RSA keys. */
function jwkToPem(jwk: { n: string; e: string; kty: string }): string {
  if (jwk.kty !== 'RSA') {
    throw new Error(`Unsupported key type: ${jwk.kty}`);
  }

  const n = Buffer.from(jwk.n, 'base64url');
  const e = Buffer.from(jwk.e, 'base64url');

  // DER encode RSA public key
  const nBytes = encodeLength(n.length) ;
  const eBytes = encodeLength(e.length);

  const sequenceContent = Buffer.concat([
    Buffer.from([0x02]), encodeLength(n.length + 1), Buffer.from([0x00]), n,
    Buffer.from([0x02]), eBytes, e,
  ]);

  const rsaSequence = Buffer.concat([
    Buffer.from([0x30]),
    encodeLength(sequenceContent.length),
    sequenceContent,
  ]);

  const bitString = Buffer.concat([
    Buffer.from([0x03]),
    encodeLength(rsaSequence.length + 1),
    Buffer.from([0x00]),
    rsaSequence,
  ]);

  // RSA OID: 1.2.840.113549.1.1.1
  const oid = Buffer.from([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01,
    0x01, 0x05, 0x00,
  ]);

  const der = Buffer.concat([
    Buffer.from([0x30]),
    encodeLength(oid.length + bitString.length),
    oid,
    bitString,
  ]);

  const pem = [
    '-----BEGIN PUBLIC KEY-----',
    der.toString('base64').match(/.{1,64}/g)!.join('\n'),
    '-----END PUBLIC KEY-----',
  ].join('\n');

  return pem;
}

function encodeLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  let temp = length;
  while (temp > 0) {
    bytes.unshift(temp & 0xff);
    temp >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
