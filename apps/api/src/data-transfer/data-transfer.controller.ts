// apps/api/src/data-transfer/data-transfer.controller.ts
import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiProduces,
} from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { DataTransferService } from './data-transfer.service';
import type { ConfirmMappings } from './data-transfer.service';
import {
  AnalyzeResultResponse,
  ImportResultResponse,
} from './dto/responses/data-transfer.response';

@ApiTags('Data Transfer')
@ApiBearerAuth('jwt')
@ApiParam({ name: 'hid', description: 'Household ID (UUID).', example: 'hh_3f8e-2c1a-...' })
@Controller('households/:hid')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class DataTransferController {
  constructor(private readonly service: DataTransferService) {}

  @Get('export')
  @ApiOperation({
    summary: 'Export the household as a JSON archive',
    description:
      'Exports transactions and/or recurring transactions of the household as a downloadable JSON archive (KlarExportFile v1). Returns the file as application/json with a Content-Disposition attachment header. Read-only — no DB writes. PRIVATE entries of other users are excluded. Any household member may call this.',
  })
  @ApiQuery({
    name: 'include',
    required: false,
    description: 'Comma-separated entities to include. Default: "transactions,recurringTransactions".',
    example: 'transactions,recurringTransactions',
  })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter transactions on/after this ISO date.', example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter transactions on/before this ISO date.', example: '2026-05-31' })
  @ApiProduces('application/json')
  @ApiResponse({
    status: 200,
    description: 'KlarExportFile v1 JSON archive (Content-Disposition: attachment).',
    schema: {
      type: 'object',
      example: {
        version: '1',
        exportedAt: '2026-05-09T07:00:00.000Z',
        includes: ['transactions', 'recurringTransactions'],
        filters: { startDate: '2026-01-01', endDate: '2026-05-31' },
        transactions: [
          {
            amountCents: -2499,
            date: '2026-05-03',
            description: 'Netflix Abo',
            visibility: 'SHARED',
            category: { name: 'Streaming', type: 'EXPENSE' },
            project: null,
          },
        ],
        recurringTransactions: [],
      },
    },
  })
  async export(
    @ReqContext() ctx: RequestContext,
    @Query('include') includeRaw: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<unknown> {
    const include = includeRaw
      ? (includeRaw.split(',').map(s => s.trim()) as ('transactions' | 'recurringTransactions')[])
      : (['transactions', 'recurringTransactions'] as ('transactions' | 'recurringTransactions')[]);

    const data = await this.service.export(ctx, { include, startDate, endDate });
    const date = new Date().toISOString().slice(0, 10);
    reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="klar-export-${date}.json"`);
    return data;
  }

  @Post('import/analyze')
  @ApiOperation({
    summary: 'Analyze a KlarExportFile for import',
    description:
      'Validates the JSON archive against the v1 schema and proposes category & project mappings (auto-resolved by name when possible). The file is NOT imported yet — this is a dry-run that lets the user pick targets for unresolved mappings before /import/confirm. Any household member may call this.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fileContent'],
      properties: {
        fileContent: {
          type: 'string',
          description: 'The full JSON contents of a KlarExportFile (as a string).',
          example: '{"version":"1","exportedAt":"...","transactions":[...]}',
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: AnalyzeResultResponse })
  @ApiResponse({ status: 400, description: 'fileContent missing or not valid JSON.' })
  @ApiResponse({ status: 422, description: 'JSON does not match KlarExportFile schema.' })
  async analyze(
    @ReqContext() ctx: RequestContext,
    @Body('fileContent') fileContent: string | undefined,
  ) {
    if (!fileContent) throw new BadRequestException('fileContent ist erforderlich');
    return this.service.analyze(ctx, fileContent);
  }

  @Post('import/confirm')
  @ApiOperation({
    summary: 'Confirm and import a KlarExportFile',
    description:
      'Imports transactions and recurring transactions into the household using the user-confirmed category/project mappings. Skips rows whose mapping is unresolved or which already exist. Idempotent on subsequent attempts when source data is unchanged.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fileContent'],
      properties: {
        fileContent: { type: 'string', description: 'KlarExportFile JSON (string).' },
        categoryMappings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sourceName: { type: 'string', example: 'Lebensmittel' },
              sourceType: { type: 'string', enum: ['EXPENSE', 'INCOME', 'FIXED_INCOME'], example: 'EXPENSE' },
              targetId: { type: 'string', example: 'cat_2a8d-...' },
            },
          },
        },
        projectMappings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sourceName: { type: 'string', example: 'Hochzeit 2026' },
              targetId: { type: 'string', example: 'prj_2a8d-...' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: ImportResultResponse })
  @ApiResponse({ status: 400, description: 'fileContent missing.' })
  @ApiResponse({ status: 422, description: 'Schema mismatch or referenced category/project does not exist.' })
  async confirm(
    @ReqContext() ctx: RequestContext,
    @Body('fileContent') fileContent: string | undefined,
    @Body('categoryMappings') categoryMappings: ConfirmMappings['categoryMappings'] = [],
    @Body('projectMappings') projectMappings: ConfirmMappings['projectMappings'] = [],
  ) {
    if (!fileContent) throw new BadRequestException('fileContent ist erforderlich');
    return this.service.confirm(ctx, fileContent, { categoryMappings, projectMappings });
  }
}
