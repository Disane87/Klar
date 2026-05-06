import { describe, expect, it } from 'vitest';
import { shouldEmitNeedMore } from './klar-virtual-list.component';

const base = { loadAheadCount: 8, hasMore: true, loading: false, lastEmittedAt: 0 };

describe('shouldEmitNeedMore', () => {
  it('emits when index reaches end - loadAheadCount', () => {
    expect(shouldEmitNeedMore({ ...base, index: 95, total: 100 })).toBe(true);
  });

  it('does not emit when far from end', () => {
    expect(shouldEmitNeedMore({ ...base, index: 50, total: 100 })).toBe(false);
  });

  it('does not emit when hasMore=false', () => {
    expect(shouldEmitNeedMore({ ...base, index: 99, total: 100, hasMore: false })).toBe(false);
  });

  it('does not emit while loading', () => {
    expect(shouldEmitNeedMore({ ...base, index: 99, total: 100, loading: true })).toBe(false);
  });

  it('does not emit when total=0', () => {
    expect(shouldEmitNeedMore({ ...base, index: 0, total: 0 })).toBe(false);
  });

  it('locks until total grows past lastEmittedAt', () => {
    expect(shouldEmitNeedMore({ ...base, index: 99, total: 100, lastEmittedAt: 100 })).toBe(false);
    expect(shouldEmitNeedMore({ ...base, index: 145, total: 150, lastEmittedAt: 100 })).toBe(true);
  });
});
