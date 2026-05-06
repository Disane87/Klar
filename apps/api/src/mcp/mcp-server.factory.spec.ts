import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import type { AuditLogParams, AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/types/request-context.type';
import { McpServerFactory } from './mcp-server.factory';
import type { McpToolDef, McpToolDeps } from './tools/tool-registry';

function buildFactory(audit: Pick<AuditService, 'log'>): McpServerFactory {
  // Domain services are unused by invokeToolWithAudit; cast undefined.
  return new McpServerFactory(
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    audit as never,
  );
}

const ctx: RequestContext = {
  userId: 'user-1',
  householdId: 'hh-1',
  source: 'mcp',
  mcpClientId: 'klar_mcp_abc',
  scopes: ['transactions:read'],
  grantId: 'g1',
  ip: '127.0.0.1',
  userAgent: 'test-ua',
};

const deps = {} as McpToolDeps;

describe('McpServerFactory.invokeToolWithAudit', () => {
  let logSpy: Mock<(p: AuditLogParams) => void>;
  let factory: McpServerFactory;

  beforeEach(() => {
    logSpy = vi.fn<(p: AuditLogParams) => void>();
    factory = buildFactory({ log: logSpy });
  });

  it('emits mcp.tool.<name> with ok:true and durationMs on success', async () => {
    const tool = {
      name: 'transactions.list',
      handler: vi.fn().mockResolvedValue({ items: [] }),
    } as unknown as McpToolDef;

    const result = await factory.invokeToolWithAudit(tool, { foo: 1 }, ctx, deps);

    expect(result.isError).toBeUndefined();
    expect(logSpy).toHaveBeenCalledTimes(1);
    const params = logSpy.mock.calls[0]![0] as AuditLogParams;
    expect(params.action).toBe('mcp.tool.transactions.list');
    expect(params.userId).toBe('user-1');
    expect(params.householdId).toBe('hh-1');
    expect(params.ip).toBe('127.0.0.1');
    expect(params.userAgent).toBe('test-ua');
    const meta = params.metadata as Record<string, unknown>;
    expect(meta.toolName).toBe('transactions.list');
    expect(meta.clientId).toBe('klar_mcp_abc');
    expect(meta.ok).toBe(true);
    expect(typeof meta.durationMs).toBe('number');
    expect(meta.argsHash).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.errorCode).toBeUndefined();
  });

  it('emits ok:false with errorCode when handler throws', async () => {
    const tool = {
      name: 'transactions.create',
      handler: vi.fn().mockRejectedValue(new TypeError('boom')),
    } as unknown as McpToolDef;

    const result = await factory.invokeToolWithAudit(tool, { a: 1 }, ctx, deps);

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe('boom');
    const meta = logSpy.mock.calls[0]![0].metadata as Record<string, unknown>;
    expect(meta.ok).toBe(false);
    expect(meta.errorCode).toBe('TypeError');
  });

  it('omits argsHash when args are empty', async () => {
    const tool = {
      name: 'health.ping',
      handler: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as McpToolDef;

    await factory.invokeToolWithAudit(tool, {}, ctx, deps);

    const meta = logSpy.mock.calls[0]![0].metadata as Record<string, unknown>;
    expect(meta.argsHash).toBeUndefined();
  });
});
