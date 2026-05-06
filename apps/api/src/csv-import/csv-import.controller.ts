import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { CsvImportService, type ConfirmPayload } from './csv-import.service';

@Controller('households/:hid/csv-import')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class CsvImportController {
  constructor(private readonly service: CsvImportService) {}

  @Post('analyze')
  analyze(@ReqContext() ctx: RequestContext, @Body('fileBase64') fileBase64: string) {
    if (!fileBase64) throw new BadRequestException('fileBase64 ist erforderlich');
    return this.service.analyze(ctx, fileBase64);
  }

  @Post('confirm')
  confirm(
    @ReqContext() ctx: RequestContext,
    @Body() body: { fileBase64: string } & ConfirmPayload,
  ) {
    if (!body.fileBase64) throw new BadRequestException('fileBase64 ist erforderlich');
    if (!body.filename) throw new BadRequestException('filename ist erforderlich');
    if (!Array.isArray(body.rows)) throw new BadRequestException('rows ist erforderlich');
    return this.service.confirm(ctx, body.fileBase64, {
      filename: body.filename,
      rows: body.rows,
    });
  }
}
