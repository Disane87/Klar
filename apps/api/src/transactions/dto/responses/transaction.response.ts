import { ApiProperty } from '@nestjs/swagger';
import { Visibility } from '@prisma/client';

export class TransactionSplitResponse {
  @ApiProperty({ description: 'Split ID (UUID).', example: 'spl_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  id!: string;

  @ApiProperty({ description: 'Free-text label for this split.', example: 'Lebensmittel' })
  label!: string;

  @ApiProperty({
    description: 'Amount in cents (signed integer).',
    example: -1495,
  })
  amountCents!: number;

  @ApiProperty({ description: 'Sort order.', example: 0 })
  sortOrder!: number;

  @ApiProperty({
    description: 'Optional category override.',
    example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
    nullable: true,
  })
  categoryId!: string | null;

  @ApiProperty({
    description: 'Optional note.',
    example: 'Wocheneinkauf',
    nullable: true,
  })
  note!: string | null;
}

export class TransactionResponse {
  @ApiProperty({
    description: 'Transaction ID (UUID v4).',
    example: '6b1f9cf2-3a7e-4d85-9f0b-6d2e0f1f1a02',
  })
  id!: string;

  @ApiProperty({
    description: 'Household this transaction belongs to.',
    example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
  })
  householdId!: string;

  @ApiProperty({
    description: 'Account this transaction is booked on.',
    example: 'acc_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
  })
  accountId!: string;

  @ApiProperty({
    description: 'User who created the row.',
    example: 'usr_8c1f4d92-5e62-4f4a-8b80-2a1d3c4e5f6a',
  })
  createdByUserId!: string;

  @ApiProperty({
    description: 'Amount in cents (signed integer; negative = expense, positive = income).',
    example: -2495,
  })
  amountCents!: number;

  @ApiProperty({
    description: 'Optional planned amount in cents.',
    example: -2500,
    nullable: true,
  })
  plannedAmountCents!: number | null;

  @ApiProperty({ description: 'Whether this row is a planned/forecast row.', example: false })
  isPlanned!: boolean;

  @ApiProperty({
    description: 'Category UUID.',
    example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
  })
  categoryId!: string;

  @ApiProperty({
    description: 'Optional project UUID.',
    example: null,
    nullable: true,
  })
  projectId!: string | null;

  @ApiProperty({
    description: 'Booking date (ISO 8601 calendar date `YYYY-MM-DD`).',
    example: '2026-05-08',
  })
  date!: string;

  @ApiProperty({
    description: 'Free-text purpose / counterparty memo.',
    example: 'EDEKA Supermarkt',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    description: 'Counterparty name parsed from the bank booking (FinTS source).',
    example: 'EDEKA SAGT DANKE',
    nullable: true,
  })
  counterparty!: string | null;

  @ApiProperty({
    description: 'Visibility scope.',
    enum: Visibility,
    example: Visibility.SHARED,
  })
  visibility!: Visibility;

  @ApiProperty({
    description: 'Optional link to the recurring-transaction template that produced this row.',
    example: null,
    nullable: true,
  })
  recurringTransactionId!: string | null;

  @ApiProperty({
    description: 'Origin of the row: `MANUAL`, `CSV_IMPORT`, or `FINTS_SYNC`.',
    example: 'FINTS_SYNC',
  })
  source!: string;

  @ApiProperty({
    description: 'Classifier derived from FinTS bookingType (Phase 14b).',
    example: 'SEPA_DIRECT_DEBIT',
    nullable: true,
  })
  transactionKind!: string | null;

  @ApiProperty({
    description: 'Raw bank label (e.g. "Folgelastschrift", "Bargeldauszahlung").',
    example: 'Folgelastschrift',
    nullable: true,
  })
  bookingText!: string | null;

  @ApiProperty({
    description:
      'ISO 8601 timestamp when the bank-derived fields were locked. Set on FinTS-imported rows.',
    example: '2026-05-08T03:00:00.000Z',
    nullable: true,
  })
  bankFieldsLockedAt!: string | null;

  @ApiProperty({
    description: 'Reference to the FinTS sync run that produced this row.',
    example: 'fsr_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
    nullable: true,
  })
  fintsSyncRunId!: string | null;

  @ApiProperty({
    description: 'Optional internal split breakdown.',
    type: () => [TransactionSplitResponse],
  })
  splits!: TransactionSplitResponse[];
}
