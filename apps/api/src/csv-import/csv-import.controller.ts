import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import type { RequestContext } from '../common/types/request-context.type';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { HouseholdMemberGuard } from '../households/guards/household-member.guard';
import { CsvImportService, type ConfirmPayload } from './csv-import.service';
import {
  CsvAnalyzeResponse,
  CsvConfirmResponse,
} from './dto/responses/csv-import.response';

@ApiTags('CSV Import')
@ApiBearerAuth('jwt')
@ApiParam({ name: 'hid', description: 'Household ID (UUID).', example: 'hh_3f8e-2c1a-...' })
@Controller('households/:hid/csv-import')
@UseGuards(ThrottlerGuard, HouseholdMemberGuard)
export class CsvImportController {
  constructor(private readonly service: CsvImportService) {}

  @Post('analyze')
  @ApiOperation({
    summary: 'Analyze a Sparkasse CAMT v2 CSV',
    description:
      'Parses the uploaded base64-encoded CAMT v2 CSV and runs duplicate detection, fixed-cost matching and category suggestion. The file is NOT persisted yet — this is a dry-run that returns per-row classifications so the user can confirm in step two. Any household member may call this.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fileBase64'],
      properties: {
        fileBase64: {
          type: 'string',
          format: 'byte',
          description: 'Base64-encoded raw CSV bytes (max 5 MiB, Sparkasse CAMT v2 format).',
          example: 'IkF1ZnRyYWdza29udG8iOyJCdWNodW5nc3RhZyI7...',
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: CsvAnalyzeResponse, description: 'Analysis result with per-row status.' })
  @ApiResponse({ status: 400, description: 'fileBase64 missing or invalid.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 403, description: 'Not a member of the household.' })
  @ApiResponse({ status: 413, description: 'File exceeds 5 MiB limit.' })
  @ApiResponse({ status: 422, description: 'CSV could not be parsed (wrong format / corrupted).' })
  analyze(@ReqContext() ctx: RequestContext, @Body('fileBase64') fileBase64: string) {
    if (!fileBase64) throw new BadRequestException('fileBase64 ist erforderlich');
    return this.service.analyze(ctx, fileBase64);
  }

  @Post('confirm')
  @ApiOperation({
    summary: 'Confirm and persist a CSV import',
    description:
      'Persists the user-confirmed rows from a previous /analyze response. Imports rows as transactions, auto-creates recurring transactions from suggestions, and writes a CsvImport audit row. Rows with status FIXED_COST_MATCH are never written as transactions — they only update the matched recurring lastSeenAt. Any household member may call this.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fileBase64', 'filename', 'rows'],
      properties: {
        fileBase64: { type: 'string', format: 'byte', description: 'Same base64 payload as in /analyze.' },
        filename: { type: 'string', example: 'umsaetze_05_2026.csv' },
        rows: {
          type: 'array',
          description: 'Per-row user decisions (skip / category / project / visibility / createNewRecurring).',
          items: {
            type: 'object',
            properties: {
              rowIndex: { type: 'integer', example: 17 },
              skip: { type: 'boolean', example: false },
              skipReason: { type: 'string', enum: ['duplicate', 'fixed', 'user'], nullable: true },
              categoryId: { type: 'string', example: 'cat_2a8d-...' },
              projectId: { type: 'string', nullable: true, example: null },
              visibility: { type: 'string', enum: ['SHARED', 'PRIVATE'], example: 'SHARED' },
              createNewRecurring: { type: 'boolean', example: false },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: CsvConfirmResponse, description: 'Import counters.' })
  @ApiResponse({ status: 400, description: 'Required fields missing or rows malformed.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 403, description: 'Not a member of the household.' })
  @ApiResponse({ status: 422, description: 'CSV no longer matches the analyzed payload.' })
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
