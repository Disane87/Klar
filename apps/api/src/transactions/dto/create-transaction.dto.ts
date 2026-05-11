import { ApiProperty } from '@nestjs/swagger';
import { Visibility } from '@prisma/client';

export class TransactionSplitDto {
  @ApiProperty({
    description: 'Existing split ID when editing — omit/null on create.',
    example: null,
    required: false,
    nullable: true,
  })
  id?: string | null;

  @ApiProperty({ description: 'Free-text label for this split.', example: 'Lebensmittel' })
  label!: string;

  @ApiProperty({
    description: 'Amount in cents (signed). Sum across splits must equal the parent `amountCents`.',
    example: -1495,
  })
  amountCents!: number;

  @ApiProperty({ description: 'Sort order in the UI.', example: 0, required: false })
  sortOrder?: number;

  @ApiProperty({
    description: 'Optional category override for this split.',
    example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
    required: false,
    nullable: true,
  })
  categoryId?: string | null;

  @ApiProperty({
    description: 'Optional note attached to this split.',
    example: 'Wocheneinkauf',
    required: false,
    nullable: true,
  })
  note?: string | null;
}

export class CreateTransactionDto {
  @ApiProperty({
    description:
      'Amount in cents (signed integer; negative = expense, positive = income). Never floats.',
    example: -2495,
  })
  amountCents!: number;

  @ApiProperty({
    description:
      'Optional planned amount in cents — used by the Planspiel/forecast flow when actual differs from the planned value.',
    example: -2500,
    required: false,
    nullable: true,
  })
  plannedAmountCents?: number | null;

  @ApiProperty({
    description: 'Whether this row represents a planned (forecasted) transaction.',
    example: false,
    required: false,
  })
  isPlanned?: boolean;

  @ApiProperty({
    description: 'Category UUID this transaction belongs to.',
    example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
  })
  categoryId!: string;

  @ApiProperty({
    description: 'Optional project UUID this transaction is allocated to.',
    example: 'prj_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
    required: false,
    nullable: true,
  })
  projectId?: string | null;

  @ApiProperty({
    description: 'Booking date (ISO 8601 calendar date `YYYY-MM-DD`).',
    example: '2026-05-08',
  })
  date!: string;

  @ApiProperty({
    description: 'Free-text purpose / counterparty memo.',
    example: 'EDEKA Supermarkt',
    required: false,
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({
    description:
      'Visibility scope. PRIVATE rows are only visible to the creator and never roll up into household aggregates.',
    enum: Visibility,
    example: Visibility.SHARED,
    required: false,
  })
  visibility?: Visibility;

  @ApiProperty({
    description: 'Optional link to the recurring-transaction template that produced this row.',
    example: null,
    required: false,
    nullable: true,
  })
  recurringTransactionId?: string | null;

  @ApiProperty({
    description: 'Optional accent color (hex).',
    example: '#22c55e',
    required: false,
    nullable: true,
  })
  color?: string | null;

  @ApiProperty({
    description: 'Optional Lucide icon slug.',
    example: 'shopping-cart',
    required: false,
    nullable: true,
  })
  icon?: string | null;

  @ApiProperty({
    description: 'Optional internal split breakdown — sum of split.amountCents must equal `amountCents`.',
    type: () => [TransactionSplitDto],
    required: false,
  })
  splits?: TransactionSplitDto[];

  @ApiProperty({
    description:
      'Optional account selection. When omitted, the household’s default csv_only account is used (FinTS Foundation 14a.1).',
    example: 'acc_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
    required: false,
  })
  accountId?: string;
}

export class UpdateTransactionDto extends CreateTransactionDto {}

export class BulkMoveTransactionsDto {
  @ApiProperty({
    description: 'Transaction UUIDs to move.',
    example: [
      '6b1f9cf2-3a7e-4d85-9f0b-6d2e0f1f1a02',
      '7c2a9df3-4b8e-4d95-8f1c-6e2f0f2f2b13',
    ],
    type: [String],
  })
  ids!: string[];

  @ApiProperty({
    description: 'Target category UUID. Caller must be allowed to mutate every row in `ids`.',
    example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
  })
  categoryId!: string;
}

export class BulkDeleteTransactionsDto {
  @ApiProperty({
    description: 'Transaction UUIDs to delete. PRIVATE rows from other users are silently filtered out.',
    example: [
      '6b1f9cf2-3a7e-4d85-9f0b-6d2e0f1f1a02',
      '7c2a9df3-4b8e-4d95-8f1c-6e2f0f2f2b13',
    ],
    type: [String],
  })
  ids!: string[];
}

export class BulkSetVisibilityDto {
  @ApiProperty({
    description: 'Transaction UUIDs to update.',
    example: [
      '6b1f9cf2-3a7e-4d85-9f0b-6d2e0f1f1a02',
      '7c2a9df3-4b8e-4d95-8f1c-6e2f0f2f2b13',
    ],
    type: [String],
  })
  ids!: string[];

  @ApiProperty({
    description:
      'Target visibility. `PRIVATE` hides the transaction from other household members in lists and aggregates; `SHARED` exposes it to everyone.',
    enum: Visibility,
    example: 'PRIVATE',
  })
  visibility!: Visibility;
}

export class BulkCountResponse {
  @ApiProperty({ description: 'Number of rows actually mutated/deleted.', example: 2 })
  count!: number;
}
