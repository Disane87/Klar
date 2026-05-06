import { describe, expect, it } from 'vitest';
import { buildToolAction, hashArgs } from './mcp-audit.helper';

describe('buildToolAction', () => {
  it('prefixes mcp.tool.', () => {
    expect(buildToolAction('transactions.list')).toBe('mcp.tool.transactions.list');
  });
});

describe('hashArgs', () => {
  it('returns sha256 hex (64 chars) and is order-stable', () => {
    const a = hashArgs({ b: 1, a: 2 });
    const b = hashArgs({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns null for undefined / null / empty object', () => {
    expect(hashArgs(undefined)).toBeNull();
    expect(hashArgs(null)).toBeNull();
    expect(hashArgs({})).toBeNull();
  });

  it('hashes nested structures deterministically', () => {
    const a = hashArgs({ nested: { z: 1, a: [3, 2, 1] } });
    const b = hashArgs({ nested: { a: [3, 2, 1], z: 1 } });
    expect(a).toBe(b);
  });

  it('produces different hashes for different content', () => {
    expect(hashArgs({ a: 1 })).not.toBe(hashArgs({ a: 2 }));
  });
});
