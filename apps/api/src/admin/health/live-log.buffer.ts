import { Injectable } from '@nestjs/common';
import { Writable } from 'node:stream';

export type LiveLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LiveLogEntry {
  ts: string;
  level: LiveLogLevel;
  msg: string;
  context?: string;
}

const MAX_ENTRIES = 200;

const PINO_LEVELS: Record<number, LiveLogLevel> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

/**
 * In-process ring buffer that captures the last N pino log entries so the
 * Admin "Live-Log" card has a real, low-latency feed without persisting
 * structured logs to the database.
 *
 * Single-instance only — when scaling horizontally each pod keeps its own
 * buffer; aggregation is out of scope for the self-host MVP.
 */
@Injectable()
export class LiveLogBuffer {
  private readonly entries: LiveLogEntry[] = [];

  push(entry: LiveLogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
  }

  /** Returns the most-recent entries, newest first. */
  getRecent(limit = 50): LiveLogEntry[] {
    const take = Math.min(Math.max(1, limit), MAX_ENTRIES);
    const start = Math.max(0, this.entries.length - take);
    return this.entries.slice(start).reverse();
  }

  size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries.length = 0;
  }

  /**
   * Writable stream that consumes pino's NDJSON output and feeds the buffer.
   * Wire this into pino via multistream so logs still go to stdout as well.
   */
  asPinoStream(): Writable {
    const buffer = this;
    return new Writable({
      write(chunk, _enc, cb): void {
        const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        for (const line of text.split('\n')) {
          if (!line) continue;
          const entry = parsePinoLine(line);
          if (entry) buffer.push(entry);
        }
        cb();
      },
    });
  }
}

function parsePinoLine(line: string): LiveLogEntry | null {
  try {
    const obj = JSON.parse(line) as {
      level?: number;
      time?: number;
      msg?: string;
      context?: string;
    };
    const level = typeof obj.level === 'number' ? PINO_LEVELS[obj.level] : undefined;
    if (!level) return null;
    const ts = typeof obj.time === 'number' ? new Date(obj.time).toISOString() : new Date().toISOString();
    const msg = typeof obj.msg === 'string' && obj.msg.length > 0 ? obj.msg : '(no message)';
    return { ts, level, msg, context: obj.context };
  } catch {
    return null;
  }
}
