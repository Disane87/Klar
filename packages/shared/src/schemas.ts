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
