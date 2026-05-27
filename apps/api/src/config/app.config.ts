import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  privateKeyPath: process.env['JWT_PRIVATE_KEY_PATH'] ?? '',
  publicKeyPath: process.env['JWT_PUBLIC_KEY_PATH'] ?? '',
  accessExpiresIn: process.env['JWT_ACCESS_EXPIRES_IN'] ?? '15m',
  refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d',
  refreshExpiresInLong: process.env['JWT_REFRESH_EXPIRES_IN_LONG'] ?? '30d',
}));

export const mailConfig = registerAs('mail', () => ({
  host: process.env['MAIL_HOST'] ?? 'localhost',
  port: Number(process.env['MAIL_PORT'] ?? 1025),
  secure: process.env['MAIL_SECURE'] === 'true',
  user: process.env['MAIL_USER'] ?? '',
  pass: process.env['MAIL_PASS'] ?? '',
  from: process.env['MAIL_FROM'] ?? 'noreply@klar.app',
  fromName: process.env['MAIL_FROM_NAME'] ?? 'Klar',
}));

export const appConfig = registerAs('app', () => ({
  baseUrl: process.env['APP_BASE_URL'] ?? 'http://localhost:3000',
  frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:4200',
  registrationEnabled: process.env['REGISTRATION_ENABLED'] !== 'false',
}));

export const oauthConfig = registerAs('oauth', () => ({
  // Pfade zum eigenen MCP-JWT-Key-Pair (getrennt vom Klar-Session-JWT).
  // Wird von scripts/generate-mcp-keys.ts angelegt falls fehlend.
  mcpPrivateKeyPath: process.env['JWT_MCP_PRIVATE_KEY_PATH'] ?? '',
  mcpPublicKeyPath: process.env['JWT_MCP_PUBLIC_KEY_PATH'] ?? '',
  mcpAudience: process.env['JWT_MCP_AUDIENCE'] ?? 'klar-mcp',
  authCodeTtlSeconds: Number(process.env['OAUTH_AUTH_CODE_TTL_SECONDS'] ?? 60),
  accessTokenTtlSeconds: Number(process.env['OAUTH_ACCESS_TOKEN_TTL_SECONDS'] ?? 3600),
  refreshTokenTtlSeconds: Number(process.env['OAUTH_REFRESH_TOKEN_TTL_SECONDS'] ?? 2_592_000),
  registrationOpen: process.env['OAUTH_REGISTRATION_OPEN'] !== 'false',
  registrationRateLimitPerHour: Number(process.env['OAUTH_REGISTRATION_RATE_LIMIT_PER_HOUR'] ?? 5),
}));

export const oidcConfig = registerAs('oidc', () => ({
  enabled: process.env['OIDC_ENABLED'] === 'true',
  providerName: process.env['OIDC_PROVIDER_NAME'] ?? 'sso',
  issuerUrl: process.env['OIDC_ISSUER_URL'] ?? '',
  clientId: process.env['OIDC_CLIENT_ID'] ?? '',
  clientSecret: process.env['OIDC_CLIENT_SECRET'] ?? '',
  redirectUri: process.env['OIDC_REDIRECT_URI'] ?? 'http://localhost:3000/api/v1/auth/oidc/callback',
  scopes: (process.env['OIDC_SCOPES'] ?? 'openid email profile').split(' '),
  requiredGroup: process.env['OIDC_REQUIRED_GROUP'] ?? '',
  adminGroup: process.env['OIDC_ADMIN_GROUP'] ?? '',
  autoJoinHouseholdId: process.env['OIDC_AUTO_JOIN_HOUSEHOLD_ID'] ?? '',
}));

// FinTS-Foundation (Phase 14a.3):
// Master-Key (32-Byte hex) für AES-256-GCM-Verschlüsselung von PIN +
// lib-fints-Sitzungs-State. Generierung via `openssl rand -hex 32`.
// Niemals ins Repo, niemals in Logs (siehe Pino-Redaction in app.module.ts).
// Backup separat zur DB sichern; ohne Master-Key sind Credentials
// unwiederherstellbar.
// Notification Rules (Phase 3) — Web Push VAPID configuration.
// Generate via `pnpm --filter @klar/api vapid:generate`. All three values
// are required to enable WEB_PUSH delivery; without them, the dispatcher
// logs a warning once and drops the push silently.
export const webPushConfig = registerAs('webPush', () => ({
  publicKey: process.env['VAPID_PUBLIC_KEY'] ?? '',
  privateKey: process.env['VAPID_PRIVATE_KEY'] ?? '',
  subject: process.env['VAPID_SUBJECT'] ?? '',
}));

export const fintsConfig = registerAs('fints', () => ({
  masterKeyHex: process.env['FINTS_MASTER_KEY'] ?? '',
  /** PSD2 Strong-Customer-Authentication-Window in Tagen (default 89). */
  scaWindowDays: Number(process.env['FINTS_SCA_WINDOW_DAYS'] ?? 89),
  /**
   * Interval in minutes between automatic FinTS sync ticks. Default 60.
   * Floored to a minimum of 5 minutes to avoid hammering the bank.
   * Set FINTS_SYNC_DISABLED=true to disable the cron entirely.
   */
  syncIntervalMinutes: Number(process.env['FINTS_SYNC_INTERVAL_MINUTES'] ?? 60),
  syncDisabled: process.env['FINTS_SYNC_DISABLED'] === 'true',
  /** Zusätzliche BLZ-Datenquellen (komma-separiert) für Phase 14a.4. */
  blzSourceUrls: (process.env['FINTS_BLZ_SOURCES'] ??
    'https://raw.githubusercontent.com/hbci4j/hbci4java/master/src/main/resources/blz.properties')
    .split(',').map(s => s.trim()).filter(Boolean),
}));
