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
  frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:4200',
  registrationEnabled: process.env['REGISTRATION_ENABLED'] !== 'false',
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
