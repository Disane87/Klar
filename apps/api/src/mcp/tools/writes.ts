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

// ── Updates ───────────────────────────────────────────────────────────

registerMcpTool({
  name: 'update_transaction',
  scope: 'klar:transactions:write',
  description:
    'Aktualisiert eine bestehende Transaktion. Nur die übergebenen Felder werden geändert. Beträge in Cents (signed).',
  inputShape: {
    id: z.string().min(1),
    amountCents: z.number().int().refine((v) => v !== 0, 'amountCents must not be 0').optional(),
    categoryId: z.string().optional(),
    date: z.string().regex(dateRegex).optional(),
    description: z.string().max(500).nullable().optional(),
    projectId: z.string().nullable().optional(),
    visibility: z.enum(['PRIVATE', 'SHARED']).optional(),
  },
  handler: async (args, ctx, deps) => {
    const { id, ...patch } = args;
    const tx = await deps.transactionsService.update(ctx, id, patch);
    return { id: tx.id, amountCents: tx.amountCents, date: tx.date };
  },
});

registerMcpTool({
  name: 'delete_transaction',
  scope: 'klar:transactions:write',
  description: 'Löscht eine Transaktion endgültig. Nicht reversibel — vorher beim User bestätigen lassen.',
  inputShape: {
    id: z.string().min(1),
  },
  handler: async (args, ctx, deps) => {
    await deps.transactionsService.remove(ctx, args.id);
    return { id: args.id, deleted: true };
  },
});

registerMcpTool({
  name: 'update_recurring',
  scope: 'klar:recurring:write',
  description: 'Aktualisiert eine wiederkehrende Buchung (Fixkosten/Fix-Einnahme).',
  inputShape: {
    id: z.string().min(1),
    name: z.string().min(1).max(100).optional(),
    amountCents: z.number().int().refine((v) => v !== 0, 'amountCents must not be 0').optional(),
    categoryId: z.string().optional(),
    frequency: z
      .enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'WEEKLY', 'HALF_YEARLY', 'CUSTOM_DAYS'])
      .optional(),
    customDays: z.number().int().min(1).nullable().optional(),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    startDate: z.string().regex(dateRegex).optional(),
    endDate: z.string().regex(dateRegex).nullable().optional(),
    visibility: z.enum(['PRIVATE', 'SHARED']).optional(),
    isVariable: z.boolean().optional(),
    isActive: z.boolean().optional(),
    note: z.string().max(500).nullable().optional(),
    color: z.string().regex(hexColor).nullable().optional(),
    icon: z.string().max(64).nullable().optional(),
    projectId: z.string().nullable().optional(),
  },
  handler: async (args, ctx, deps) => {
    const { id, ...patch } = args;
    const r = await deps.recurringService.update(ctx, id, patch);
    return { id: r.id };
  },
});

registerMcpTool({
  name: 'delete_recurring',
  scope: 'klar:recurring:write',
  description: 'Löscht eine wiederkehrende Buchung endgültig (z.B. nach Vertragskündigung). Nicht reversibel.',
  inputShape: {
    id: z.string().min(1),
  },
  handler: async (args, ctx, deps) => {
    await deps.recurringService.remove(ctx, args.id);
    return { id: args.id, deleted: true };
  },
});

registerMcpTool({
  name: 'update_category',
  scope: 'klar:categories:write',
  description: 'Aktualisiert eine Kategorie. Optional `isArchived: true` zum Ausblenden ohne Löschen.',
  inputShape: {
    id: z.string().min(1),
    name: z.string().min(1).max(50).optional(),
    color: z.string().regex(hexColor).optional(),
    icon: z.string().max(64).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    isArchived: z.boolean().optional(),
  },
  handler: async (args, ctx, deps) => {
    const { id, ...patch } = args;
    const c = await deps.categoriesService.update(ctx, id, patch);
    return { id: c.id };
  },
});

registerMcpTool({
  name: 'delete_category',
  scope: 'klar:categories:write',
  description:
    'Löscht eine Kategorie. Schlägt fehl wenn noch Transaktionen/Recurrings/Budgets daran hängen — dann besser archivieren via update_category.',
  inputShape: {
    id: z.string().min(1),
  },
  handler: async (args, ctx, deps) => {
    await deps.categoriesService.remove(ctx, args.id);
    return { id: args.id, deleted: true };
  },
});

registerMcpTool({
  name: 'update_project',
  scope: 'klar:projects:write',
  description: 'Aktualisiert ein Projekt — z.B. Status auf COMPLETED oder Budget anpassen.',
  inputShape: {
    id: z.string().min(1),
    name: z.string().min(1).max(100).optional(),
    color: z.string().regex(hexColor).optional(),
    description: z.string().max(500).nullable().optional(),
    status: z.enum(['PLANNING', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
    totalBudgetCents: z.number().int().positive().nullable().optional(),
    startDate: z.string().regex(dateRegex).nullable().optional(),
    endDate: z.string().regex(dateRegex).nullable().optional(),
    visibility: z.enum(['PRIVATE', 'SHARED']).optional(),
  },
  handler: async (args, ctx, deps) => {
    const { id, ...patch } = args;
    const p = await deps.projectsService.update(ctx, id, patch);
    return { id: p.id };
  },
});

registerMcpTool({
  name: 'delete_project',
  scope: 'klar:projects:write',
  description: 'Löscht ein Projekt endgültig. Zugeordnete Buchungen verlieren die Project-Referenz.',
  inputShape: {
    id: z.string().min(1),
  },
  handler: async (args, ctx, deps) => {
    await deps.projectsService.remove(ctx, args.id);
    return { id: args.id, deleted: true };
  },
});

registerMcpTool({
  name: 'delete_budget',
  scope: 'klar:budgets:write',
  description: 'Entfernt das Budget für eine Kategorie/Monat. Idempotent.',
  inputShape: {
    id: z.string().min(1),
  },
  handler: async (args, ctx, deps) => {
    await deps.budgetsService.remove(ctx, args.id);
    return { id: args.id, deleted: true };
  },
});
