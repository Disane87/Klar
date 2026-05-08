import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { FintsRealtimeService } from './fints-realtime.service';

describe('FintsRealtimeService', () => {
  let svc: FintsRealtimeService;

  beforeEach(() => {
    vi.useFakeTimers();
    svc = new FintsRealtimeService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('replays the most recent event to a late subscriber', async () => {
    svc.emit('run-1', 'tan-required', { foo: 'bar' });
    const event = await firstValueFrom(svc.stream('run-1'));
    expect(event).toEqual({
      type: 'tan-required',
      syncRunId: 'run-1',
      data: { foo: 'bar' },
    });
  });

  it('streams subsequent events to an existing subscriber', () => {
    const events: { type: string }[] = [];
    svc.stream('run-2').subscribe(e => events.push(e));
    svc.emit('run-2', 'tan-required', { step: 1 });
    svc.emit('run-2', 'ok', { step: 2 });
    expect(events.map(e => e.type)).toEqual(['tan-required', 'ok']);
  });

  it('keeps the stream alive after a terminal event for the drain window', () => {
    svc.emit('run-3', 'ok', { syncRun: { id: 'run-3' } });
    // Within drain window: late subscribers still see the OK event.
    const seen: unknown[] = [];
    svc.stream('run-3').subscribe(e => seen.push(e));
    expect(seen).toHaveLength(1);
  });

  it('garbage-collects the stream after the drain window elapses', () => {
    svc.emit('run-4', 'failed', { error: 'nope' });
    // Advance past the 30s grace period.
    vi.advanceTimersByTime(60_000);
    // A new subscriber after eviction creates a fresh subject and gets nothing.
    const seen: unknown[] = [];
    svc.stream('run-4').subscribe(e => seen.push(e));
    expect(seen).toHaveLength(0);
  });

  it('isolates streams across distinct sync run ids', async () => {
    svc.emit('run-a', 'tan-required', { which: 'a' });
    svc.emit('run-b', 'tan-required', { which: 'b' });
    const a = await firstValueFrom(svc.stream('run-a'));
    const b = await firstValueFrom(svc.stream('run-b'));
    expect(a.syncRunId).toBe('run-a');
    expect(b.syncRunId).toBe('run-b');
  });
});
