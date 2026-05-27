import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export const FINTS_SYNC_INTERVALS = [
  'MANUAL',
  'H4',
  'H6',
  'H12',
  'H24',
  'H48',
  'H168',
] as const;
export type FintsSyncIntervalDto = (typeof FINTS_SYNC_INTERVALS)[number];

export class UpdateFintsConnectionDto {
  @ApiPropertyOptional({
    description:
      'Per-connection sync cadence. MANUAL disables the cron entirely for this connection.',
    enum: FINTS_SYNC_INTERVALS,
    example: 'H24',
  })
  @IsOptional()
  @IsEnum(FINTS_SYNC_INTERVALS)
  syncInterval?: FintsSyncIntervalDto;

  @ApiPropertyOptional({
    description:
      'Master kill-switch independent of the interval. Set false to pause sync without changing the user preference.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;
}
