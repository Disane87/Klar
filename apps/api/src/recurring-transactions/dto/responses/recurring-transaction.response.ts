import { ApiProperty } from '@nestjs/swagger';
import { RecurringFrequency, Visibility } from '@prisma/client';

export class RecurringTransactionResponse {
  @ApiProperty({ description: 'Recurring template ID (UUID).', example: 'rt_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  id!: string;

  @ApiProperty({ description: 'Household this template belongs to.', example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  householdId!: string;

  @ApiProperty({ description: 'User who created this template.', example: 'usr_8c1f4d92-5e62-4f4a-8b80-2a1d3c4e5f6a' })
  createdByUserId!: string;

  @ApiProperty({ description: 'Display name.', example: 'Netflix Abo' })
  name!: string;

  @ApiProperty({ description: 'Amount in cents (signed integer).', example: -1799 })
  amountCents!: number;

  @ApiProperty({ description: 'Category UUID.', example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  categoryId!: string;

  @ApiProperty({ description: 'Project UUID.', example: null, nullable: true })
  projectId!: string | null;

  @ApiProperty({ description: 'Recurrence frequency.', enum: RecurringFrequency, example: RecurringFrequency.MONTHLY })
  frequency!: RecurringFrequency;

  @ApiProperty({ description: 'Custom interval in days (only for `CUSTOM_DAYS`).', example: null, nullable: true })
  customDays!: number | null;

  @ApiProperty({ description: 'Day-of-month (1..31).', example: 1, nullable: true })
  dayOfMonth!: number | null;

  @ApiProperty({ description: 'First occurrence (`YYYY-MM-DD`).', example: '2026-05-01' })
  startDate!: string;

  @ApiProperty({ description: 'Last occurrence (`YYYY-MM-DD`).', example: null, nullable: true })
  endDate!: string | null;

  @ApiProperty({ description: 'Visibility scope.', enum: Visibility, example: Visibility.SHARED })
  visibility!: Visibility;

  @ApiProperty({ description: 'Whether the amount is variable.', example: false })
  isVariable!: boolean;

  @ApiProperty({ description: 'Optional free-text note.', example: 'Streaming-Abo, monatlich', nullable: true })
  note!: string | null;

  @ApiProperty({ description: 'Whether the recurring is currently active.', example: true })
  isActive!: boolean;

  @ApiProperty({
    description:
      'Snapshot of the GrossToNetInput when this row was last computed from gross. ' +
      '`null` for entries entered as a plain net amount.',
    type: Object,
    nullable: true,
    example: null,
  })
  payrollInput!: Record<string, unknown> | null;

  @ApiProperty({ description: 'ISO 8601 creation timestamp.', example: '2026-04-15T08:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ description: 'ISO 8601 last-update timestamp.', example: '2026-05-08T10:15:00.000Z' })
  updatedAt!: string;
}
