import { describe, expect, it } from 'vitest';
import { LiveLogBuffer } from './live-log.buffer';

describe('LiveLogBuffer', () => {
  it('returns the most recent entries newest first', () => {
    const buf = new LiveLogBuffer();
    buf.push({ ts: '2026-05-07T10:00:00.000Z', level: 'info', msg: 'first' });
    buf.push({ ts: '2026-05-07T10:00:01.000Z', level: 'warn', msg: 'second' });
    buf.push({ ts: '2026-05-07T10:00:02.000Z', level: 'error', msg: 'third' });

    const recent = buf.getRecent(10);

    expect(recent.map((e) => e.msg)).toEqual(['third', 'second', 'first']);
  });

  it('caps size at 200 by dropping oldest entries', () => {
    const buf = new LiveLogBuffer();
    for (let i = 0; i < 250; i++) {
      buf.push({ ts: new Date(i).toISOString(), level: 'info', msg: `m${i}` });
    }

    expect(buf.size()).toBe(200);
    const recent = buf.getRecent(200);
    expect(recent[0]!.msg).toBe('m249');
    expect(recent[recent.length - 1]!.msg).toBe('m50');
  });

  it('parses pino NDJSON and pushes onto the buffer', async () => {
    const buf = new LiveLogBuffer();
    const stream = buf.asPinoStream();

    await new Promise<void>((resolve, reject) => {
      stream.write(
        JSON.stringify({ level: 30, time: 1715075200000, msg: 'http request', context: 'Bootstrap' }) +
          '\n' +
          JSON.stringify({ level: 50, time: 1715075201000, msg: 'boom' }) +
          '\n',
        (err) => (err ? reject(err) : resolve()),
      );
    });

    const recent = buf.getRecent(10);
    expect(recent).toHaveLength(2);
    expect(recent[0]).toMatchObject({ level: 'error', msg: 'boom' });
    expect(recent[1]).toMatchObject({ level: 'info', msg: 'http request', context: 'Bootstrap' });
  });

  it('skips lines that are not valid pino JSON', async () => {
    const buf = new LiveLogBuffer();
    const stream = buf.asPinoStream();

    await new Promise<void>((resolve, reject) => {
      stream.write('plain text\n{not json\n\n', (err) => (err ? reject(err) : resolve()));
    });

    expect(buf.size()).toBe(0);
  });

  it('respects the limit parameter and clamps to 1..200', () => {
    const buf = new LiveLogBuffer();
    for (let i = 0; i < 30; i++) {
      buf.push({ ts: new Date(i).toISOString(), level: 'info', msg: `m${i}` });
    }

    expect(buf.getRecent(0)).toHaveLength(1);
    expect(buf.getRecent(5)).toHaveLength(5);
    expect(buf.getRecent(99)).toHaveLength(30);
  });

  it('clear() empties the buffer', () => {
    const buf = new LiveLogBuffer();
    buf.push({ ts: '2026-05-07T10:00:00.000Z', level: 'info', msg: 'x' });
    buf.clear();

    expect(buf.size()).toBe(0);
    expect(buf.getRecent()).toEqual([]);
  });
});
