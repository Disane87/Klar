import { ApiProperty } from '@nestjs/swagger';
import { RecurringFrequency, Visibility } from '@prisma/client';

export class CreateRecurringTransactionDto {
  @ApiProperty({ description: 'Display name for this recurring template.', example: 'Netflix Abo' })
  name!: string;

  @ApiProperty({
    description: 'Amount in cents (signed integer; negative = expense, positive = income).',
    example: -1799,
  })
  amountCents!: number;

  @ApiProperty({
    description: 'Category UUID this recurring belongs to.',
    example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
  })
  categoryId!: string;

  @ApiProperty({
    description: 'Optional project UUID this recurring is allocated to.',
    example: null,
    required: false,
    nullable: true,
  })
  projectId?: string | null;

  @ApiProperty({
    description: 'Recurrence frequency.',
    enum: RecurringFrequency,
    example: RecurringFrequency.MONTHLY,
  })
  frequency!: RecurringFrequency;

  @ApiProperty({
    description: 'For `CUSTOM_DAYS` frequency: number of days between occurrences.',
    example: 14,
    required: false,
    nullable: true,
  })
  customDays?: number | null;

  @ApiProperty({
    description:
      'For `MONTHLY`/`QUARTERLY`/`YEARLY` frequencies: 1..31. Clamped to month-end via `safeDayOfMonth()`.',
    example: 1,
    required: false,
    nullable: true,
  })
  dayOfMonth?: number | null;

  @ApiProperty({
    description: 'First occurrence date (`YYYY-MM-DD`).',
    example: '2026-05-01',
  })
  startDate!: string;

  @ApiProperty({
    description: 'Optional end date (`YYYY-MM-DD`). Open-ended when omitted.',
    example: null,
    required: false,
    nullable: true,
  })
  endDate?: string | null;

  @ApiProperty({
    description: 'Visibility scope.',
    enum: Visibility,
    example: Visibility.SHARED,
    required: false,
  })
  visibility?: Visibility;

  @ApiProperty({
    description: 'Whether the amount is variable (e.g. utility bill). Marks the row as estimate-only.',
    example: false,
    required: false,
  })
  isVariable?: boolean;

  @ApiProperty({
    description: 'Optional free-text note.',
    example: 'Streaming-Abo, monatlich',
    required: false,
    nullable: true,
  })
  note?: string | null;

  @ApiProperty({ description: 'Optional accent color (hex).', example: '#60a5fa', required: false, nullable: true })
  color?: string | null;

  @ApiProperty({ description: 'Optional Lucide icon slug.', example: 'film', required: false, nullable: true })
  icon?: string | null;

  @ApiProperty({
    description: 'Whether the recurring is active. Inactive rows are not produced/forecasted.',
    example: true,
    required: false,
  })
  isActive?: boolean;
}

export class UpdateRecurringTransactionDto extends CreateRecurringTransactionDto {}

export class SetActiveDto {
  @ApiProperty({ description: 'Target active state.', example: false })
  isActive!: boolean;
}

export class BulkPauseDto {
  @ApiProperty({
    description: 'Recurring-transaction UUIDs to pause/resume.',
    example: ['rt_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02'],
    type: [String],
  })
  ids!: string[];

  @ApiProperty({
    description: 'Pass `true` to bulk-resume; default `false` (pause).',
    example: false,
    required: false,
  })
  isActive?: boolean;
}

export class BulkPauseResponse {
  @ApiProperty({ description: 'Number of rows actually toggled.', example: 1 })
  count!: number;
}
