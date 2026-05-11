import { Injectable, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { OAuthScope } from '@klar/shared';
import type { RequestContext } from '../common/types/request-context.type';
import { APP_VERSION } from '../common/app-version';
import { AuditService } from '../audit/audit.service';
import { TransactionsService } from '../transactions/transactions.service';
import { RecurringTransactionsService } from '../recurring-transactions/recurring-transactions.service';
import { CategoriesService } from '../categories/categories.service';
import { ProjectsService } from '../projects/projects.service';
import { BudgetsService } from '../budgets/budgets.service';
import { OverviewService } from '../overview/overview.service';
import { HouseholdsService } from '../households/households.service';
import { buildToolAction, hashArgs } from './mcp-audit.helper';
import { MCP_TOOLS, type McpToolDef, type McpToolDeps } from './tools/tool-registry';
// Side-effect import: registriert alle Tools im Registry.
import './tools';

const SERVER_INFO = {
  name: 'klar',
  version: APP_VERSION,
} as const;

@Injectable()
export class McpServerFactory {
  private readonly logger = new Logger(McpServerFactory.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly recurringService: RecurringTransactionsService,
    private readonly categoriesService: CategoriesService,
    private readonly projectsService: ProjectsService,
    private readonly budgetsService: BudgetsService,
    private readonly overviewService: OverviewService,
    private readonly householdsService: HouseholdsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Pro MCP-Request einen frischen `McpServer` mit Streamable-HTTP-Transport.
   * Stateless mode (`sessionIdGenerator: undefined`) — jede Anfrage steht für sich,
   * Berechtigungen werden vom OAuth-Bearer-Guard geliefert.
   */
  async createServer(ctx: RequestContext): Promise<{ server: McpServer; transport: StreamableHTTPServerTransport }> {
    const server = new McpServer(SERVER_INFO);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    const deps = this.buildDeps();
    const userScopes = (ctx.scopes ?? []) as OAuthScope[];

    for (const tool of MCP_TOOLS) {
      // Tools, deren Scope nicht im Token steht, sind dem LLM gar nicht sichtbar.
      if (!userScopes.includes(tool.scope)) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (server.registerTool as any)(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.inputShape,
        },
        (args: unknown) => this.invokeToolWithAudit(tool, args, ctx, deps),
      );
    }

    await server.connect(transport);
    return { server, transport };
  }

  /**
   * Invokes a tool handler and emits one AuditLog entry with timing, ok/fail
   * and a hash of the args. Public for testability — exercised via factory tests.
   */
  async invokeToolWithAudit(
    tool: { name: string; handler: McpToolDef['handler'] },
    args: unknown,
    ctx: RequestContext,
    deps: McpToolDeps,
  ): Promise<{
    isError?: boolean;
    content: Array<{ type: 'text'; text: string }>;
  }> {
    const startedAt = Date.now();
    let ok = false;
    let errorCode: string | undefined;
    try {
      const result = await tool.handler(args as Record<string, unknown>, ctx, deps);
      ok = true;
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      errorCode = err instanceof Error ? err.name : 'Error';
      this.logger.warn(
        `MCP tool ${tool.name} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: err instanceof Error ? err.message : 'tool execution failed',
          },
        ],
      };
    } finally {
      const argsHash = hashArgs(args);
      this.audit.log({
        userId: ctx.userId,
        householdId: ctx.householdId,
        action: buildToolAction(tool.name),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: {
          toolName: tool.name,
          clientId: ctx.mcpClientId,
          durationMs: Date.now() - startedAt,
          ok,
          ...(errorCode !== undefined ? { errorCode } : {}),
          ...(argsHash !== null ? { argsHash } : {}),
        },
      });
    }
  }

  private buildDeps(): McpToolDeps {
    return {
      transactionsService: this.transactionsService,
      recurringService: this.recurringService,
      categoriesService: this.categoriesService,
      projectsService: this.projectsService,
      budgetsService: this.budgetsService,
      overviewService: this.overviewService,
      householdsService: this.householdsService,
    };
  }
}
