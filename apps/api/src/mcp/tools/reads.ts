import { z } from 'zod';
import { registerMcpTool } from './tool-registry';

const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

registerMcpTool({
  name: 'list_transactions',
  scope: 'klar:transactions:read',
  description:
    'Listet Transaktionen des Users im aktiven Haushalt. Beträge sind in Cents (signed: + Einnahme, − Ausgabe). Datum im Format YYYY-MM-DD.',
  inputShape: {
    month: z.string().regex(monthRegex).optional().describe('Monatsfilter YYYY-MM, optional.'),
    categoryId: z.string().optional(),
    projectId: z.string().optional(),
  },
  handler: async (args, ctx, deps) => {
    const items = await deps.transactionsService.list(ctx, {
      month: args.month,
      categoryId: args.categoryId,
      projectId: args.projectId,
    });
    return { items };
  },
});

registerMcpTool({
  name: 'list_recurring',
  scope: 'klar:recurring:read',
  description: 'Listet wiederkehrende Buchungen (Fixkosten, regelmäßige Einnahmen).',
  inputShape: {
    isActive: z.boolean().optional(),
  },
  handler: async (args, ctx, deps) => {
    const items = await deps.recurringService.list(ctx, { isActive: args.isActive });
    return { items };
  },
});

registerMcpTool({
  name: 'list_categories',
  scope: 'klar:categories:read',
  description: 'Listet Kategorien des Haushalts. Optional gefiltert nach Typ und Archivstatus.',
  inputShape: {
    type: z
      .enum([
        'FIXED_INCOME',
        'VARIABLE_INCOME',
        'FIXED_EXPENSE',
        'VARIABLE_EXPENSE',
        'SAVINGS',
        'INCOME',
        'EXPENSE',
      ])
      .optional(),
    includeArchived: z.boolean().optional(),
  },
  handler: async (args, ctx, deps) => {
    const items = await deps.categoriesService.list(ctx, {
      type: args.type,
      includeArchived: args.includeArchived,
    });
    return { items };
  },
});

registerMcpTool({
  name: 'list_projects',
  scope: 'klar:projects:read',
  description: 'Listet Projekte des Haushalts. Optional gefiltert nach Status.',
  inputShape: {
    status: z.enum(['PLANNING', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  },
  handler: async (args, ctx, deps) => {
    const items = await deps.projectsService.list(ctx, { status: args.status });
    return { items };
  },
});

registerMcpTool({
  name: 'list_budgets',
  scope: 'klar:budgets:read',
  description: 'Listet Budgets pro Kategorie für einen Monat (YYYY-MM).',
  inputShape: {
    month: z.string().regex(monthRegex).optional(),
    categoryId: z.string().optional(),
  },
  handler: async (args, ctx, deps) => {
    const items = await deps.budgetsService.list(ctx, {
      month: args.month,
      categoryId: args.categoryId,
    });
    return { items };
  },
});

registerMcpTool({
  name: 'get_overview',
  scope: 'klar:overview:read',
  description:
    'Aggregierte Monatsübersicht: Fixkosten, Cashflow und Projekt-Aktivität für den angegebenen Monat (YYYY-MM).',
  inputShape: {
    month: z.string().regex(monthRegex).describe('Monat im Format YYYY-MM.'),
  },
  handler: async (args, ctx, deps) => {
    const [fixedCosts, cashflow, projects] = await Promise.all([
      deps.overviewService.getFixedCosts(ctx, args.month),
      deps.overviewService.getCashflow(ctx, args.month),
      deps.overviewService.getProjects(ctx),
    ]);
    return { month: args.month, fixedCosts, cashflow, projects };
  },
});

registerMcpTool({
  name: 'get_household_info',
  scope: 'klar:household:read',
  description: 'Basis-Infos zum aktiven Haushalt des Users (Name, Mitgliederzahl).',
  inputShape: {},
  handler: async (_args, ctx, deps) => {
    const household = await deps.householdsService.getHousehold(ctx);
    const members = await deps.householdsService.listMembers(ctx);
    return {
      id: household.id,
      name: household.name,
      memberCount: members.length,
    };
  },
});
