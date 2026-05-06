import { z } from 'zod';

/**
 * RFC 7591 — Dynamic Client Registration request payload.
 *
 * Validierung:
 * - `client_name` 1..100 Zeichen
 * - `redirect_uris` 1..5 — jede URI muss `https://...` ODER ein Loopback-`http(s)://...`
 *   sein. `http://` auf öffentlichen Hostnames wird abgelehnt.
 * - `token_endpoint_auth_method` ∈ {none, client_secret_post}
 * - `grant_types` ⊆ {authorization_code, refresh_token}
 * - `response_types` = ["code"]
 *
 * Optionale Felder werden 1:1 in die Response zurückgespielt.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isLoopbackUrl(url: URL): boolean {
  // Strip IPv6-Klammern: "[::1]" -> "::1"
  const host = url.hostname.replace(/^\[|\]$/g, '');
  return LOOPBACK_HOSTS.has(host);
}

function isValidRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  // Fragmente sind in OAuth-Redirect-URIs nicht erlaubt (RFC 6749 §3.1.2)
  if (url.hash) return false;
  if (url.protocol === 'https:') return true;
  if (url.protocol === 'http:' && isLoopbackUrl(url)) return true;
  // Custom-Schemes für native Apps (z.B. "myapp://callback") sind in MCP-Praxis
  // verbreitet — wir lassen sie zu, aber nur ohne Hostname.
  if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.hostname === '') {
    return true;
  }
  return false;
}

const HTTPS_OR_EMPTY_URL = z
  .string()
  .url()
  .optional()
  .refine(
    (val): boolean => val === undefined || val === '' || /^https?:\/\//.test(val),
    { message: 'must be an http(s) URL' },
  );

export const registerClientSchema = z.object({
  client_name: z.string().trim().min(1).max(100),
  redirect_uris: z
    .array(z.string())
    .min(1, 'at least one redirect_uri required')
    .max(5, 'maximum 5 redirect_uris')
    .refine(
      (uris) => uris.every(isValidRedirectUri),
      'redirect_uri must be https://, loopback http://, or a private-scheme URI',
    ),
  token_endpoint_auth_method: z.enum(['none', 'client_secret_post']).default('none'),
  grant_types: z
    .array(z.enum(['authorization_code', 'refresh_token']))
    .nonempty()
    .default(['authorization_code', 'refresh_token']),
  response_types: z.array(z.literal('code')).default(['code']),
  logo_uri: HTTPS_OR_EMPTY_URL,
  client_uri: HTTPS_OR_EMPTY_URL,
  tos_uri: HTTPS_OR_EMPTY_URL,
  policy_uri: HTTPS_OR_EMPTY_URL,
  // Werden ignoriert — wir geben die Liste autoritativ aus.
  scope: z.string().optional(),
});

export type RegisterClientInput = z.input<typeof registerClientSchema>;
export type RegisterClientParsed = z.output<typeof registerClientSchema>;
