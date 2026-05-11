import { ApiProperty } from '@nestjs/swagger';

export class AuthUserResponse {
  @ApiProperty({ description: 'User ID (UUID).', example: '7f9a2b3c-8d1e-4f5a-9b7c-8d9e0f1a2b3c' })
  id!: string;

  @ApiProperty({ description: 'Account email address.', example: 'alex@example.com' })
  email!: string;

  @ApiProperty({ description: 'Display name shown in the UI.', example: 'Alex Example' })
  displayName!: string;

  @ApiProperty({
    description: 'Application-level role.',
    example: 'USER',
    enum: ['USER', 'ADMIN'],
  })
  appRole!: string;

  @ApiProperty({
    description: 'Avatar image URL (or null if none uploaded).',
    example: '/api/v1/users/me/avatar/abc123.png',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({
    description: 'Whether the account email has been verified.',
    example: true,
  })
  emailVerified!: boolean;

  @ApiProperty({
    description: 'Whether the user has 2FA (TOTP) enabled.',
    example: false,
  })
  totpEnabled!: boolean;
}

export class LoginSuccessResponse {
  @ApiProperty({
    description: 'Short-lived JWT access token (15 minutes). Send as Authorization: Bearer …',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.…',
  })
  accessToken!: string;

  @ApiProperty({ type: () => AuthUserResponse })
  user!: AuthUserResponse;
}

export class TotpChallengeResponse {
  @ApiProperty({
    description: 'Always true when 2FA verification is required to complete login.',
    example: true,
  })
  requiresTotp!: true;

  @ApiProperty({
    description: 'Short-lived token (5 min) to be passed to POST /auth/totp/verify with the TOTP code.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXAiOiJ0b3RwIn0.abcdef',
  })
  tempToken!: string;
}

export class RegisterResponseDto {
  @ApiProperty({ description: 'Newly created account ID.', example: '7f9a2b3c-8d1e-4f5a-9b7c-8d9e0f1a2b3c' })
  id!: string;

  @ApiProperty({ description: 'Account email address.', example: 'alex@example.com' })
  email!: string;

  @ApiProperty({ description: 'Display name.', example: 'Alex Example' })
  displayName!: string;

  @ApiProperty({
    description: 'Whether the verification email was queued. False when registration is disabled or the user must wait.',
    example: true,
  })
  verificationEmailSent!: boolean;
}

export class RefreshResponseDto {
  @ApiProperty({
    description: 'New short-lived access token. The refresh_token cookie is rotated transparently.',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.…',
  })
  accessToken!: string;

  @ApiProperty({ type: () => AuthUserResponse })
  user!: AuthUserResponse;
}

export class MessageResponse {
  @ApiProperty({ description: 'Human-readable status message.', example: 'E-Mail-Adresse erfolgreich bestätigt.' })
  message!: string;
}

export class OidcConfigResponse {
  @ApiProperty({ description: 'Whether OIDC login is enabled on this instance.', example: true })
  enabled!: boolean;

  @ApiProperty({ description: 'Display name of the configured OIDC provider.', example: 'PocketID' })
  providerName!: string;
}

export class OidcAuthorizeUrlResponse {
  @ApiProperty({
    description: 'IdP authorization URL the browser should be redirected to.',
    example: 'https://id.example.com/authorize?client_id=klar&response_type=code&state=…',
  })
  authorizeUrl!: string;
}

export class OidcIdentityResponse {
  @ApiProperty({ description: 'Provider name.', example: 'pocketid' })
  providerName!: string;

  @ApiProperty({ description: 'Email reported by the IdP.', example: 'alex@example.com' })
  email!: string;

  @ApiProperty({ description: 'When the identity was first linked (ISO 8601).', example: '2026-01-15T10:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({
    description: 'Last successful login through this identity (ISO 8601, or null).',
    example: '2026-05-09T08:12:00.000Z',
    nullable: true,
  })
  lastLoginAt!: string | null;
}

export class TotpSetupResponse {
  @ApiProperty({
    description: 'Base32-encoded TOTP shared secret. Show it once if the user wants to enter it manually.',
    example: 'JBSWY3DPEHPK3PXP',
  })
  secret!: string;

  @ApiProperty({
    description: 'otpauth:// URI; encode as QR code in the UI.',
    example: 'otpauth://totp/Klar:alex@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Klar',
  })
  uri!: string;
}

export class SessionResponse {
  @ApiProperty({ description: 'Refresh-token (session) ID.', example: '7f9a2b3c-8d1e-4f5a-9b7c-8d9e0f1a2b3c' })
  id!: string;

  @ApiProperty({ description: 'IP address that created the session.', example: '203.0.113.42', nullable: true })
  ip!: string | null;

  @ApiProperty({ description: 'User-Agent string.', example: 'Mozilla/5.0 …', nullable: true })
  userAgent!: string | null;

  @ApiProperty({ description: 'When the session was created (ISO 8601).', example: '2026-05-09T08:12:00.000Z' })
  createdAt!: string;

  @ApiProperty({ description: 'When the refresh token expires (ISO 8601).', example: '2026-05-16T08:12:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ description: 'Whether this session belongs to the current request.', example: true })
  current!: boolean;
}
