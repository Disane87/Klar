import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EmailStatus } from '@prisma/client';
import { AppAdminGuard } from '../common/guards/app-admin.guard';
import { AdminService } from './admin.service';
import {
  AuditLogPageResponse,
  EmailLogPageResponse,
  HouseholdSummaryResponse,
  McpAuditLogPageResponse,
} from './dto/responses/audit-log.response';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function parsePageSize(value: string | undefined): number {
  if (!value) return DEFAULT_PAGE_SIZE;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1 || n > MAX_PAGE_SIZE) {
    throw new BadRequestException(`pageSize muss zwischen 1 und ${MAX_PAGE_SIZE} liegen`);
  }
  return n;
}

function parseCursor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function parseDate(value: string | undefined, field: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`${field} ist kein gültiges Datum`);
  }
  return d;
}

function parseBool(value: string | undefined, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new BadRequestException(`${field} muss true oder false sein`);
}

@ApiTags('Admin')
@ApiBearerAuth('jwt')
@Controller('admin')
@UseGuards(AppAdminGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('audit-logs')
  @ApiOperation({
    summary: 'List audit log entries (admin)',
    description:
      'Returns a cursor-paginated list of audit log entries across the entire instance. Requires `appRole = ADMIN`. Supports free-text search and filtering by action prefix, user, household, and time range.',
  })
  @ApiQuery({ name: 'cursor', required: false, description: 'Opaque cursor from a previous response.', example: 'eyJpZCI6ImF1ZF8wMUhYIn0=' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size (1–200, default 50).', example: 50 })
  @ApiQuery({ name: 'q', required: false, description: 'Free-text search across action, IP, user agent, metadata.', example: 'login' })
  @ApiQuery({ name: 'actionPrefix', required: false, description: 'Match only actions starting with this prefix.', example: 'auth.' })
  @ApiQuery({ name: 'action', required: false, description: 'Match an exact action key.', example: 'auth.login' })
  @ApiQuery({ name: 'userId', required: false, description: 'Limit to one user.', example: 'usr_8c1f4d92-5e62-4f4a-8b80-2a1d3c4e5f6a' })
  @ApiQuery({ name: 'householdId', required: false, description: 'Limit to one household.', example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiQuery({ name: 'from', required: false, description: 'Lower bound (ISO 8601).', example: '2026-05-01T00:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, description: 'Upper bound (ISO 8601).', example: '2026-05-10T23:59:59.999Z' })
  @ApiResponse({ status: 200, type: AuditLogPageResponse })
  @ApiResponse({ status: 400, description: 'Invalid query parameters (e.g. pageSize out of range, malformed date).' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not an app admin.' })
  listAuditLogs(
    @Query('cursor') cursor?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
    @Query('actionPrefix') actionPrefix?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('householdId') householdId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.listAuditLogs({
      pageSize: parsePageSize(pageSize),
      cursor: parseCursor(cursor),
      q: trim(q),
      actionPrefix: trim(actionPrefix),
      action: trim(action),
      userId: trim(userId),
      householdId: trim(householdId),
      from: parseDate(from, 'from'),
      to: parseDate(to, 'to'),
    });
  }

  @Get('mcp')
  @ApiOperation({
    summary: 'List MCP tool-call audit entries (admin)',
    description:
      'Returns a cursor-paginated list of MCP tool invocations (audit rows with `action` prefixed `mcp.`). Requires `appRole = ADMIN`. Tool args are never stored in plaintext — only their sha256 hash is logged.',
  })
  @ApiQuery({ name: 'cursor', required: false, description: 'Opaque pagination cursor.', example: 'eyJpZCI6Im1jcF8wMUhYIn0=' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size (1–200, default 50).', example: 50 })
  @ApiQuery({ name: 'q', required: false, description: 'Free-text search.', example: 'transactions' })
  @ApiQuery({ name: 'userId', required: false, example: 'usr_8c1f4d92-5e62-4f4a-8b80-2a1d3c4e5f6a' })
  @ApiQuery({ name: 'householdId', required: false, example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiQuery({ name: 'toolName', required: false, description: 'Filter by MCP tool name.', example: 'transactions.list' })
  @ApiQuery({ name: 'clientId', required: false, description: 'Filter by OAuth client.', example: 'oac_01HX...' })
  @ApiQuery({ name: 'ok', required: false, description: 'Filter by success flag (`true` or `false`).', example: 'true' })
  @ApiQuery({ name: 'from', required: false, example: '2026-05-01T00:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, example: '2026-05-10T23:59:59.999Z' })
  @ApiResponse({ status: 200, type: McpAuditLogPageResponse })
  @ApiResponse({ status: 400, description: 'Invalid query parameters.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not an app admin.' })
  listMcpAuditLogs(
    @Query('cursor') cursor?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
    @Query('userId') userId?: string,
    @Query('householdId') householdId?: string,
    @Query('toolName') toolName?: string,
    @Query('clientId') clientId?: string,
    @Query('ok') ok?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.listMcpAuditLogs({
      pageSize: parsePageSize(pageSize),
      cursor: parseCursor(cursor),
      q: trim(q),
      userId: trim(userId),
      householdId: trim(householdId),
      toolName: trim(toolName),
      clientId: trim(clientId),
      ok: parseBool(ok, 'ok'),
      from: parseDate(from, 'from'),
      to: parseDate(to, 'to'),
    });
  }

  @Get('emails')
  @ApiOperation({
    summary: 'List sent and failed emails (admin)',
    description:
      'Returns a cursor-paginated list of outbound email log rows across the instance. Requires `appRole = ADMIN`. Useful to debug delivery problems for invites, password resets, TOTP notices, etc.',
  })
  @ApiQuery({ name: 'cursor', required: false, example: 'eyJpZCI6ImVtbF8wMUhYIn0=' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size (1–200, default 50).', example: 50 })
  @ApiQuery({ name: 'q', required: false, description: 'Free-text search across recipient, subject, template, error.', example: 'invite' })
  @ApiQuery({ name: 'status', required: false, enum: ['SENT', 'FAILED'], example: 'SENT' })
  @ApiQuery({ name: 'template', required: false, description: 'Filter by template key.', example: 'INVITE' })
  @ApiQuery({ name: 'householdId', required: false, example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  @ApiQuery({ name: 'from', required: false, example: '2026-05-01T00:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, example: '2026-05-10T23:59:59.999Z' })
  @ApiResponse({ status: 200, type: EmailLogPageResponse })
  @ApiResponse({ status: 400, description: 'Invalid query parameters.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not an app admin.' })
  listEmails(
    @Query('cursor') cursor?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('template') template?: string,
    @Query('householdId') householdId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    let parsedStatus: EmailStatus | undefined;
    if (status) {
      if (status !== 'SENT' && status !== 'FAILED') {
        throw new BadRequestException('status muss SENT oder FAILED sein');
      }
      parsedStatus = status;
    }

    return this.service.listEmailLogs({
      pageSize: parsePageSize(pageSize),
      cursor: parseCursor(cursor),
      q: trim(q),
      status: parsedStatus,
      template: trim(template),
      householdId: trim(householdId),
      from: parseDate(from, 'from'),
      to: parseDate(to, 'to'),
    });
  }

  @Get('households')
  @ApiOperation({
    summary: 'List all households with members (admin)',
    description:
      'Returns every household in the instance, each with its member roster (display name, email, role, joined-at). Requires `appRole = ADMIN`. Not paginated — instances stay small enough for a single page.',
  })
  @ApiResponse({ status: 200, type: HouseholdSummaryResponse, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Caller is not an app admin.' })
  listHouseholds() {
    return this.service.listHouseholds();
  }
}

function trim(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}
