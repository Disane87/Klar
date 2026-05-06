import { z } from 'zod';

/**
 * RFC 6749 §4.1.3 (Authorization Code Grant) und §6 (Refresh Grant).
 * Wir nutzen ein Discriminated Union via `grant_type`.
 *
 * `client_secret` ist optional — public PKCE-Clients (Standard für MCP-Desktop)
 * senden ihn nicht.
 */
export const tokenRequestSchema = z.discriminatedUnion('grant_type', [
  z.object({
    grant_type: z.literal('authorization_code'),
    code: z.string().min(1),
    redirect_uri: z.string().url(),
    client_id: z.string().min(1),
    client_secret: z.string().optional(),
    code_verifier: z.string().min(43).max(128),
  }),
  z.object({
    grant_type: z.literal('refresh_token'),
    refresh_token: z.string().min(1),
    client_id: z.string().min(1),
    client_secret: z.string().optional(),
    scope: z.string().optional(),
  }),
]);

export type TokenRequest = z.output<typeof tokenRequestSchema>;
