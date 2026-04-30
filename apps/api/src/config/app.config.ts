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
  from: process.env['MAIL_FROM'] ?? 'noreply@klar.app',
  fromName: process.env['MAIL_FROM_NAME'] ?? 'Klar',
}));

export const appConfig = registerAs('app', () => ({
  frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:4200',
  registrationEnabled: process.env['REGISTRATION_ENABLED'] !== 'false',
}));
