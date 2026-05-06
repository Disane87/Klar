import { createHash } from 'node:crypto';

export function buildToolAction(toolName: string): string {
  return `mcp.tool.${toolName}`;
}

export function hashArgs(args: unknown): string | null {
  if (args === undefined || args === null) return null;
  if (typeof args === 'object' && Object.keys(args as Record<string, unknown>).length === 0) {
    return null;
  }
  return createHash('sha256').update(stableStringify(args)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}
