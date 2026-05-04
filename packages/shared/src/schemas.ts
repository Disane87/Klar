// Single source of truth für alle zod-Schemas. Nie in apps/ definieren.
import { z } from 'zod';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase()),
  displayName: z.string().min(1).max(100).trim(),
  password: z.string().min(8).max(128),
});

export const LoginSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase()),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

export const ResendVerificationSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase()),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

// ─── Import / Export ──────────────────────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

export const KlarExportTransactionSchema = z.object({
  amountCents: z.number().int(),
  date: isoDate,
  description: z.string().nullable().optional(),
  visibility: z.enum(['SHARED', 'PRIVATE']),
  category: z.object({ name: z.string(), type: z.enum(['EXPENSE', 'INCOME', 'FIXED_INCOME']) }),
  project: z.object({ name: z.string() }).nullable().optional(),
});

export const KlarExportRecurringSchema = z.object({
  name: z.string(),
  amountCents: z.number().int(),
  frequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM_DAYS']),
  customDays: z.number().int().nullable().optional(),
  dayOfMonth: z.number().int().nullable().optional(),
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
  visibility: z.enum(['SHARED', 'PRIVATE']),
  isVariable: z.boolean(),
  isActive: z.boolean(),
  note: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  category: z.object({ name: z.string(), type: z.enum(['EXPENSE', 'INCOME', 'FIXED_INCOME']) }),
  project: z.object({ name: z.string() }).nullable().optional(),
});

export const KlarExportFileSchema = z.object({
  version: z.literal('1'),
  exportedAt: z.string(),
  includes: z.array(z.enum(['transactions', 'recurringTransactions'])),
  filters: z.object({
    startDate: isoDate.nullable().optional(),
    endDate: isoDate.nullable().optional(),
  }),
  transactions: z.array(KlarExportTransactionSchema).optional().default([]),
  recurringTransactions: z.array(KlarExportRecurringSchema).optional().default([]),
});

export type KlarExportFile = z.infer<typeof KlarExportFileSchema>;
export type KlarExportTransaction = z.infer<typeof KlarExportTransactionSchema>;
export type KlarExportRecurring = z.infer<typeof KlarExportRecurringSchema>;
