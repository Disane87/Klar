import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EmailStatus } from '@prisma/client';
import { AppAdminGuard } from '../common/guards/app-admin.guard';
import { AdminService } from './admin.service';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function parsePage(value: string | undefined): number {
  if (!value) return 1;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) throw new BadRequestException('Ungültiger page-Parameter');
  return n;
}

function parsePageSize(value: string | undefined): number {
  if (!value) return DEFAULT_PAGE_SIZE;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1 || n > MAX_PAGE_SIZE) {
    throw new BadRequestException(`pageSize muss zwischen 1 und ${MAX_PAGE_SIZE} liegen`);
  }
  return n;
}

@Controller('admin')
@UseGuards(AppAdminGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('audit-logs')
  async listAuditLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('action') action?: string,
    @Query('householdId') householdId?: string,
    @Query('userId') userId?: string,
  ) {
    const result = await this.service.listAuditLogs({
      page: parsePage(page),
      pageSize: parsePageSize(pageSize),
      action: action?.trim() || undefined,
      householdId: householdId?.trim() || undefined,
      userId: userId?.trim() || undefined,
    });
    return {
      ...result,
      data: result.data.map((l) => this.service.toAuditResponse(l)),
    };
  }

  @Get('emails')
  async listEmails(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('householdId') householdId?: string,
  ) {
    let parsedStatus: EmailStatus | undefined;
    if (status) {
      if (status !== 'SENT' && status !== 'FAILED') {
        throw new BadRequestException('status muss SENT oder FAILED sein');
      }
      parsedStatus = status;
    }

    const result = await this.service.listEmailLogs({
      page: parsePage(page),
      pageSize: parsePageSize(pageSize),
      status: parsedStatus,
      householdId: householdId?.trim() || undefined,
    });
    return {
      ...result,
      data: result.data.map((l) => this.service.toEmailResponse(l)),
    };
  }

  @Get('households')
  listHouseholds() {
    return this.service.listHouseholds();
  }
}
