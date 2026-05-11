import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

/**
 * Optional date-range for a manual / wizard-triggered sync.
 *
 * Both dates are ISO 8601 `YYYY-MM-DD` (no time component) so the bank
 * sees the same calendar day regardless of the caller's TZ. When
 * omitted the sync falls back to its normal heuristic: 90 days on
 * first sync, 2-day overlap on subsequent runs.
 *
 * Range validation (fromDate <= toDate, no future, within bank
 * `maxLookbackDays`) lives in the service layer — the DTO only checks
 * the wire format so we can return RFC 7807 problem details from a
 * single place.
 */
export class TriggerSyncDto {
  @ApiProperty({
    description:
      'Inclusive start of the statement window (ISO `YYYY-MM-DD`). When omitted, the sync uses the connection’s normal lookback (90 days first time, 2-day overlap thereafter).',
    example: '2026-02-10',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fromDate must be ISO YYYY-MM-DD',
  })
  fromDate?: string;

  @ApiProperty({
    description: 'Inclusive end of the statement window (ISO `YYYY-MM-DD`). Defaults to today.',
    example: '2026-05-11',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'toDate must be ISO YYYY-MM-DD',
  })
  toDate?: string;
}
