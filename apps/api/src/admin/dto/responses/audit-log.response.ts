import { ApiProperty } from '@nestjs/swagger';

export class ResolvedUserResponse {
  @ApiProperty({ example: 'usr_8c1f4d92-5e62-4f4a-8b80-2a1d3c4e5f6a' })
  id!: string;

  @ApiProperty({ example: 'Marco Franke' })
  displayName!: string;

  @ApiProperty({ example: 'marco@example.com' })
  email!: string;

  @ApiProperty({ nullable: true, example: null })
  avatarUrl!: string | null;
}

export class ResolvedHouseholdResponse {
  @ApiProperty({ example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  id!: string;

  @ApiProperty({ example: 'Familie Franke' })
  name!: string;
}

export class AuditLogResponse {
  @ApiProperty({ description: 'Audit-log row ID.', example: 'aud_01HX9...' })
  id!: string;

  @ApiProperty({ description: 'ISO 8601 timestamp.', example: '2026-05-10T08:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({
    description: 'Action key (dot-namespaced, e.g. `auth.login`, `transactions.create`).',
    example: 'auth.login',
  })
  action!: string;

  @ApiProperty({ nullable: true, example: '203.0.113.5' })
  ip!: string | null;

  @ApiProperty({ nullable: true, example: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' })
  userAgent!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Free-form metadata bag attached at log time. Shape depends on `action`.',
    example: { reason: 'invalid_password' },
  })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ type: ResolvedUserResponse, nullable: true })
  user!: ResolvedUserResponse | null;

  @ApiProperty({ type: ResolvedHouseholdResponse, nullable: true })
  household!: ResolvedHouseholdResponse | null;
}

export class McpAuditLogResponse extends AuditLogResponse {
  @ApiProperty({ nullable: true, example: 'transactions.list' })
  toolName!: string | null;

  @ApiProperty({ nullable: true, example: 'oac_01HX...' })
  clientId!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Display name of the OAuth client (auto-captured from MCP `initialize`).',
    example: 'claude-ai (via mcp-remote 0.1.37)',
  })
  clientName!: string | null;

  @ApiProperty({ nullable: true, example: 142 })
  durationMs!: number | null;

  @ApiProperty({ nullable: true, example: true })
  ok!: boolean | null;

  @ApiProperty({ nullable: true, example: null })
  errorCode!: string | null;
}

export class EmailLogResponse {
  @ApiProperty({ example: 'eml_01HX...' })
  id!: string;

  @ApiProperty({ example: '2026-05-10T08:30:00.000Z' })
  sentAt!: string;

  @ApiProperty({ example: 'recipient@example.com' })
  to!: string;

  @ApiProperty({ example: 'Welcome to Klar' })
  subject!: string;

  @ApiProperty({ example: 'INVITE' })
  template!: string;

  @ApiProperty({ enum: ['SENT', 'FAILED'], example: 'SENT' })
  status!: 'SENT' | 'FAILED';

  @ApiProperty({ nullable: true, example: null })
  error!: string | null;

  @ApiProperty({ type: ResolvedUserResponse, nullable: true })
  user!: ResolvedUserResponse | null;

  @ApiProperty({ type: ResolvedHouseholdResponse, nullable: true })
  household!: ResolvedHouseholdResponse | null;
}

export class CursorPageMeta {
  @ApiProperty({
    nullable: true,
    description: 'Opaque cursor — pass back as `?cursor=` to fetch the next page. `null` when there is no further page.',
    example: 'eyJpZCI6ImF1ZF8wMUhYIn0=',
  })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Whether more rows exist beyond this page.', example: true })
  hasMore!: boolean;
}

export class AuditLogPageResponse extends CursorPageMeta {
  @ApiProperty({ type: AuditLogResponse, isArray: true })
  data!: AuditLogResponse[];
}

export class McpAuditLogPageResponse extends CursorPageMeta {
  @ApiProperty({ type: McpAuditLogResponse, isArray: true })
  data!: McpAuditLogResponse[];
}

export class EmailLogPageResponse extends CursorPageMeta {
  @ApiProperty({ type: EmailLogResponse, isArray: true })
  data!: EmailLogResponse[];
}

export class HouseholdMemberSummary {
  @ApiProperty({ example: 'usr_8c1f4d92-5e62-4f4a-8b80-2a1d3c4e5f6a' })
  userId!: string;

  @ApiProperty({ example: 'Marco Franke' })
  displayName!: string;

  @ApiProperty({ example: 'marco@example.com' })
  email!: string;

  @ApiProperty({ nullable: true, example: null })
  avatarUrl!: string | null;

  @ApiProperty({ enum: ['OWNER', 'MEMBER'], example: 'OWNER' })
  role!: 'OWNER' | 'MEMBER';

  @ApiProperty({ example: '2026-04-01T08:30:00.000Z' })
  joinedAt!: string;
}

export class HouseholdSummaryResponse {
  @ApiProperty({ example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  id!: string;

  @ApiProperty({ example: 'Familie Franke' })
  name!: string;

  @ApiProperty({ example: '2026-04-01T08:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ type: HouseholdMemberSummary, isArray: true })
  members!: HouseholdMemberSummary[];
}
