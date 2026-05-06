import type { z } from 'zod';
import type { OAuthScope } from '@klar/shared';
import type { RequestContext } from '../../common/types/request-context.type';

/**
 * Domänen-Services, die die Tool-Handler aufrufen können.
 * Wird vom McpServerFactory mit echten Instanzen per DI bestückt.
 */
export interface McpToolDeps {
  transactionsService: import('../../transactions/transactions.service').TransactionsService;
  recurringService: import('../../recurring-transactions/recurring-transactions.service').RecurringTransactionsService;
  categoriesService: import('../../categories/categories.service').CategoriesService;
  projectsService: import('../../projects/projects.service').ProjectsService;
  budgetsService: import('../../budgets/budgets.service').BudgetsService;
  overviewService: import('../../overview/overview.service').OverviewService;
  householdsService: import('../../households/households.service').HouseholdsService;
}

export interface McpToolDef<TInput extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  description: string;
  scope: OAuthScope;
  inputShape: TInput;
  handler: (
    args: z.infer<z.ZodObject<TInput>>,
    ctx: RequestContext,
    deps: McpToolDeps,
  ) => Promise<unknown>;
}

/** Wird in Phase 9/10 mit den eigentlichen Tool-Definitions befüllt. */
export const MCP_TOOLS: McpToolDef[] = [];

export function registerMcpTool<T extends z.ZodRawShape>(def: McpToolDef<T>): void {
  MCP_TOOLS.push(def as unknown as McpToolDef);
}
