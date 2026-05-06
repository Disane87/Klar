import { describe, it, expect } from 'vitest';
import { createHash, randomBytes } from 'crypto';
import { verifyS256 } from './pkce.util';

function challengeFromVerifier(verifier: string): string {
  return createHash('sha256')
    .update(verifier)
    .digest()
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

describe('verifyS256', () => {
  it('verifies a known RFC 7636 vector', () => {
    // RFC 7636 Appendix B
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    expect(verifyS256(verifier, challenge)).toBe(true);
  });

  it('verifies generated pairs', () => {
    for (let i = 0; i < 5; i++) {
      const verifier = randomBytes(48).toString('base64url').slice(0, 64);
      const challenge = challengeFromVerifier(verifier);
      expect(verifyS256(verifier, challenge)).toBe(true);
    }
  });

  it('rejects mismatched challenge', () => {
    const verifier = 'a'.repeat(43);
    const challenge = challengeFromVerifier('different');
    expect(verifyS256(verifier, challenge)).toBe(false);
  });

  it('rejects too-short verifier', () => {
    const verifier = 'a'.repeat(42);
    const challenge = challengeFromVerifier(verifier);
    expect(verifyS256(verifier, challenge)).toBe(false);
  });

  it('rejects too-long verifier', () => {
    const verifier = 'a'.repeat(129);
    const challenge = challengeFromVerifier(verifier);
    expect(verifyS256(verifier, challenge)).toBe(false);
  });

  it('rejects verifier with disallowed chars', () => {
    const verifier = 'a'.repeat(43) + ' '; // space disallowed
    const challenge = challengeFromVerifier(verifier);
    expect(verifyS256(verifier.trim() + ' ', challenge)).toBe(false);
  });
});
