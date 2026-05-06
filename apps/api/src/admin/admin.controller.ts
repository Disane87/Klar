import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EmailStatus } from '@prisma/client';
import { AppAdminGuard } from '../common/guards/app-admin.guard';
import { AdminService } from './admin.service';

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

@Controller('admin')
@UseGuards(AppAdminGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('audit-logs')
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
  listHouseholds() {
    return this.service.listHouseholds();
  }
}

function trim(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}
