import { Injectable, Logger } from '@nestjs/common';
import { Observable, ReplaySubject } from 'rxjs';

export type FintsRunEventType = 'tan-required' | 'ok' | 'failed' | 'progress';

export interface FintsRunEvent {
  type: FintsRunEventType;
  syncRunId: string;
  /** Serialised payload for the SSE consumer (sync run snapshot, challenge, etc.). */
  data: unknown;
}

interface StreamEntry {
  subject: ReplaySubject<FintsRunEvent>;
  closing?: NodeJS.Timeout;
}

/**
 * In-process pub/sub for FinTS sync-run state changes.
 *
 * Powers two things at once:
 *   - SSE endpoint: GET /households/:hid/fints/sync-runs/:id/events
 *   - Decoupled / pushTAN auto-poll: emits 'ok' / 'failed' so the wizard
 *     auto-progresses when the bank confirms — without the user having to
 *     click "Fertig".
 *
 * ReplaySubject(1) guarantees a subscriber that connects shortly after the
 * terminal emit still receives it (the wizard's HTTP response → EventSource
 * subscribe race window is in the hundreds of ms, but lib-fints can confirm
 * faster than that on a primed connection). After a terminal event we keep
 * the stream alive for {@link DRAIN_GRACE_MS} so very-late subscribers can
 * still pick up the result; older entries are garbage-collected.
 */
@Injectable()
export class FintsRealtimeService {
  private readonly logger = new Logger(FintsRealtimeService.name);
  private readonly streams = new Map<string, StreamEntry>();
  private static readonly DRAIN_GRACE_MS = 30_000;

  stream(syncRunId: string): Observable<FintsRunEvent> {
    return this.ensure(syncRunId).subject.asObservable();
  }

  emit(syncRunId: string, type: FintsRunEventType, data: unknown): void {
    const entry = this.ensure(syncRunId);
    entry.subject.next({ type, syncRunId, data });
    if (type === 'ok' || type === 'failed') {
      this.scheduleClose(syncRunId, entry);
    }
  }

  private ensure(syncRunId: string): StreamEntry {
    let entry = this.streams.get(syncRunId);
    if (!entry) {
      entry = { subject: new ReplaySubject<FintsRunEvent>(1) };
      this.streams.set(syncRunId, entry);
    }
    return entry;
  }

  private scheduleClose(syncRunId: string, entry: StreamEntry): void {
    if (entry.closing) clearTimeout(entry.closing);
    entry.closing = setTimeout(() => {
      entry.subject.complete();
      this.streams.delete(syncRunId);
    }, FintsRealtimeService.DRAIN_GRACE_MS);
  }
}
