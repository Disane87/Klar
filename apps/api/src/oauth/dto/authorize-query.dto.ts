import { z } from 'zod';
import { OAUTH_SCOPES } from '../oauth-scopes';

/**
 * GET /oauth2/authorize Query-Parameter (RFC 6749 §4.1.1 + RFC 7636).
 *
 * Wir akzeptieren:
 * - response_type=code (Pflicht)
 * - code_challenge_method=S256 (Pflicht — `plain` ist nicht erlaubt)
 * - scope: space-separated, jeder Token muss in OAUTH_SCOPES liegen
 *
 * `state` ist Pflicht — auch wenn die Spec das nur empfiehlt, schützt es
 * Clients vor CSRF und ist im MCP-Ökosystem Standard.
 */
export const authorizeQuerySchema = z.object({
  response_type: z.literal('code', { errorMap: () => ({ message: 'response_type must be "code"' }) }),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z
    .string()
    .min(1)
    .refine(
      (s) => {
        const tokens = s.split(/\s+/).filter(Boolean);
        return (
          tokens.length > 0 &&
          tokens.every((t) => (OAUTH_SCOPES as readonly string[]).includes(t))
        );
      },
      { message: 'scope contains an unknown value' },
    ),
  state: z.string().min(1).max(512),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256', { errorMap: () => ({ message: 'code_challenge_method must be "S256"' }) }),
});

export type AuthorizeQuery = z.output<typeof authorizeQuerySchema>;
