import { Injectable, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { OAuthScope } from '@klar/shared';
import type { RequestContext } from '../common/types/request-context.type';
import { TransactionsService } from '../transactions/transactions.service';
import { RecurringTransactionsService } from '../recurring-transactions/recurring-transactions.service';
import { CategoriesService } from '../categories/categories.service';
import { ProjectsService } from '../projects/projects.service';
import { BudgetsService } from '../budgets/budgets.service';
import { OverviewService } from '../overview/overview.service';
import { HouseholdsService } from '../households/households.service';
import { MCP_TOOLS, type McpToolDeps } from './tools/tool-registry';
// Side-effect import: registriert alle Tools im Registry.
import './tools';

const SERVER_INFO = {
  name: 'klar',
  version: '0.1.0',
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
        async (args: unknown) => {
          try {
            const result = await tool.handler(
              args as Record<string, unknown>,
              ctx,
              deps,
            );
            return {
              content: [
                { type: 'text' as const, text: JSON.stringify(result, null, 2) },
              ],
            };
          } catch (err) {
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
          }
        },
      );
    }

    await server.connect(transport);
    return { server, transport };
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
