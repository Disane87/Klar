import { z } from 'zod';
import { registerMcpTool } from './tool-registry';

const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
const hexColor = /^#[0-9a-fA-F]{6}$/;

registerMcpTool({
  name: 'create_transaction',
  scope: 'klar:transactions:write',
  description:
    'Legt eine neue Transaktion an. amountCents als Ganzzahl in Cents, signed (positiv = Einnahme, negativ = Ausgabe). date als YYYY-MM-DD.',
  inputShape: {
    amountCents: z.number().int().refine((v) => v !== 0, 'amountCents must not be 0').describe('Cents, signed (>0=Einnahme, <0=Ausgabe).'),
    categoryId: z.string().min(1),
    date: z.string().regex(dateRegex),
    description: z.string().max(500).optional(),
    projectId: z.string().optional(),
    visibility: z.enum(['PRIVATE', 'SHARED']).optional(),
  },
  handler: async (args, ctx, deps) => {
    const tx = await deps.transactionsService.create(ctx, {
      amountCents: args.amountCents,
      categoryId: args.categoryId,
      date: args.date,
      description: args.description ?? null,
      projectId: args.projectId ?? null,
      visibility: args.visibility,
    });
    return { id: tx.id, amountCents: tx.amountCents, date: tx.date };
  },
});

registerMcpTool({
  name: 'create_recurring',
  scope: 'klar:recurring:write',
  description: 'Legt eine wiederkehrende Buchung an (Fixkosten, regelmäßige Einnahmen).',
  inputShape: {
    name: z.string().min(1).max(100),
    amountCents: z.number().int().refine((v) => v !== 0, 'amountCents must not be 0'),
    categoryId: z.string().min(1),
    frequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'WEEKLY', 'HALF_YEARLY', 'CUSTOM_DAYS']),
    customDays: z.number().int().min(1).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    startDate: z.string().regex(dateRegex),
    endDate: z.string().regex(dateRegex).optional(),
    visibility: z.enum(['PRIVATE', 'SHARED']).optional(),
    isVariable: z.boolean().optional(),
    note: z.string().max(500).optional(),
    color: z.string().regex(hexColor).optional(),
    icon: z.string().max(64).optional(),
    projectId: z.string().optional(),
  },
  handler: async (args, ctx, deps) => {
    const r = await deps.recurringService.create(ctx, {
      name: args.name,
      amountCents: args.amountCents,
      categoryId: args.categoryId,
      frequency: args.frequency,
      customDays: args.customDays ?? null,
      dayOfMonth: args.dayOfMonth ?? null,
      startDate: args.startDate,
      endDate: args.endDate ?? null,
      visibility: args.visibility,
      isVariable: args.isVariable,
      note: args.note ?? null,
      color: args.color ?? null,
      icon: args.icon ?? null,
      projectId: args.projectId ?? null,
    });
    return { id: r.id };
  },
});

registerMcpTool({
  name: 'create_category',
  scope: 'klar:categories:write',
  description: 'Legt eine Kategorie an. Hex-Farbe (#RRGGBB).',
  inputShape: {
    name: z.string().min(1).max(50),
    type: z.enum([
      'FIXED_INCOME',
      'VARIABLE_INCOME',
      'FIXED_EXPENSE',
      'VARIABLE_EXPENSE',
      'SAVINGS',
      'INCOME',
      'EXPENSE',
    ]),
    color: z.string().regex(hexColor),
    icon: z.string().max(64).optional(),
  },
  handler: async (args, ctx, deps) => {
    const c = await deps.categoriesService.create(ctx, {
      name: args.name,
      type: args.type,
      color: args.color,
      icon: args.icon ?? null,
    });
    return { id: c.id };
  },
});

registerMcpTool({
  name: 'create_project',
  scope: 'klar:projects:write',
  description: 'Legt ein Projekt an.',
  inputShape: {
    name: z.string().min(1).max(100),
    color: z.string().regex(hexColor),
    description: z.string().max(500).optional(),
    totalBudgetCents: z.number().int().positive().optional(),
    startDate: z.string().regex(dateRegex).optional(),
    endDate: z.string().regex(dateRegex).optional(),
    visibility: z.enum(['PRIVATE', 'SHARED']).optional(),
  },
  handler: async (args, ctx, deps) => {
    const p = await deps.projectsService.create(ctx, {
      name: args.name,
      color: args.color,
      description: args.description ?? null,
      totalBudgetCents: args.totalBudgetCents ?? null,
      startDate: args.startDate ?? null,
      endDate: args.endDate ?? null,
      visibility: args.visibility,
    });
    return { id: p.id };
  },
});

registerMcpTool({
  name: 'set_budget',
  scope: 'klar:budgets:write',
  description: 'Setzt oder aktualisiert ein Budget für (Kategorie, Monat). amountCents > 0.',
  inputShape: {
    categoryId: z.string().min(1),
    month: z.string().regex(monthRegex),
    amountCents: z.number().int().positive(),
  },
  handler: async (args, ctx, deps) => {
    const b = await deps.budgetsService.upsert(ctx, {
      categoryId: args.categoryId,
      month: args.month,
      amountCents: args.amountCents,
    });
    return { id: b.id };
  },
});
