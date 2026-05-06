import { describe, expect, it } from 'vitest';
import {
  OAUTH_SCOPES,
  SCOPE_DISPLAY,
  isOAuthScope,
  isScopeSubset,
  parseScopeString,
} from './oauth-scopes';

describe('oauth-scopes', () => {
  it('exports 12 scopes', () => {
    expect(OAUTH_SCOPES).toHaveLength(12);
  });

  it('has display entry for every scope', () => {
    for (const scope of OAUTH_SCOPES) {
      const display = SCOPE_DISPLAY[scope];
      expect(display).toBeDefined();
      expect(display.title).toMatch(/.+/);
      expect(display.desc).toMatch(/.+/);
      expect(display.icon).toMatch(/^[a-z][a-z-]*$/);
    }
  });

  it('has unique scope names', () => {
    expect(new Set(OAUTH_SCOPES).size).toBe(OAUTH_SCOPES.length);
  });

  describe('isOAuthScope', () => {
    it('accepts known scopes', () => {
      expect(isOAuthScope('klar:transactions:read')).toBe(true);
    });

    it('rejects unknown scopes', () => {
      expect(isOAuthScope('klar:unknown:read')).toBe(false);
      expect(isOAuthScope('')).toBe(false);
      expect(isOAuthScope('admin')).toBe(false);
    });
  });

  describe('parseScopeString', () => {
    it('parses space-separated scope string', () => {
      const result = parseScopeString('klar:transactions:read klar:overview:read');
      expect(result).toEqual(['klar:transactions:read', 'klar:overview:read']);
    });

    it('deduplicates scopes', () => {
      const result = parseScopeString('klar:transactions:read klar:transactions:read');
      expect(result).toEqual(['klar:transactions:read']);
    });

    it('handles extra whitespace', () => {
      const result = parseScopeString('  klar:transactions:read   klar:overview:read  ');
      expect(result).toEqual(['klar:transactions:read', 'klar:overview:read']);
    });

    it('returns empty array for empty input', () => {
      expect(parseScopeString('')).toEqual([]);
      expect(parseScopeString('   ')).toEqual([]);
    });

    it('throws on unknown scope', () => {
      expect(() => parseScopeString('klar:transactions:read klar:bogus:read')).toThrow(
        /Unknown OAuth scope: klar:bogus:read/,
      );
    });
  });

  describe('isScopeSubset', () => {
    it('returns true when requested is subset of granted', () => {
      expect(
        isScopeSubset(
          ['klar:transactions:read'],
          ['klar:transactions:read', 'klar:overview:read'],
        ),
      ).toBe(true);
    });

    it('returns true for empty requested', () => {
      expect(isScopeSubset([], ['klar:transactions:read'])).toBe(true);
    });

    it('returns false when requested has scope not in granted', () => {
      expect(
        isScopeSubset(
          ['klar:transactions:write'],
          ['klar:transactions:read'],
        ),
      ).toBe(false);
    });

    it('returns false against empty granted', () => {
      expect(isScopeSubset(['klar:transactions:read'], [])).toBe(false);
    });
  });
});
