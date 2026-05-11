import { ApiProperty } from '@nestjs/swagger';
import { FixedCostCycle, FixedCostSource, FixedCostStatus } from '@prisma/client';

export class ContractResponse {
  @ApiProperty({ description: 'Contract ID (UUID).', example: 'ct_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  id!: string;

  @ApiProperty({ description: 'Cancellation deadline (`YYYY-MM-DD`).', example: '2026-12-31', nullable: true })
  cancelByAt!: string | null;

  @ApiProperty({ description: 'Contract start date (`YYYY-MM-DD`).', example: '2024-01-15', nullable: true })
  contractStartedAt!: string | null;

  @ApiProperty({ description: 'Contract holder name.', example: 'Marco Franke', nullable: true })
  contractHolder!: string | null;

  @ApiProperty({ description: 'Provider-issued contract number.', example: 'NFX-2024-58721', nullable: true })
  contractNumber!: string | null;

  @ApiProperty({ description: 'Provider name.', example: 'Netflix International B.V.', nullable: true })
  providerName!: string | null;

  @ApiProperty({ description: 'URL to stored contract document.', example: null, nullable: true })
  documentUrl!: string | null;

  @ApiProperty({ description: 'Free-text notes.', example: null, nullable: true })
  notes!: string | null;

  @ApiProperty({ description: 'ISO 8601 creation timestamp.', example: '2026-04-15T08:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ description: 'ISO 8601 last-update timestamp.', example: '2026-05-08T10:15:00.000Z' })
  updatedAt!: string;
}

export class FixedCostResponse {
  @ApiProperty({ description: 'Fixed-cost ID (UUID).', example: 'fc_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  id!: string;

  @ApiProperty({ description: 'Household this row belongs to.', example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  householdId!: string;

  @ApiProperty({ description: 'Display name.', example: 'Netflix Standard' })
  name!: string;

  @ApiProperty({ description: 'Counterparty / merchant string.', example: 'NETFLIX.COM', nullable: true })
  merchant!: string | null;

  @ApiProperty({ description: 'Optional category UUID.', example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02', nullable: true })
  categoryId!: string | null;

  @ApiProperty({ description: 'Amount in cents (signed integer).', example: -1799 })
  amountCents!: number;

  @ApiProperty({ description: 'Billing cycle.', enum: FixedCostCycle, example: FixedCostCycle.MONTHLY })
  cycle!: FixedCostCycle;

  @ApiProperty({ description: 'Next renewal date (`YYYY-MM-DD`).', example: '2026-06-01', nullable: true })
  nextRenewalAt!: string | null;

  @ApiProperty({
    description: 'Detection confidence on auto-detected rows (0..1). `null` for manual entries.',
    example: 0.92,
    nullable: true,
  })
  confidence!: number | null;

  @ApiProperty({ description: 'Lifecycle status.', enum: FixedCostStatus, example: FixedCostStatus.CONFIRMED })
  status!: FixedCostStatus;

  @ApiProperty({ description: 'Origin: `MANUAL` or `AUTO_DETECTED`.', enum: FixedCostSource, example: FixedCostSource.AUTO_DETECTED })
  source!: FixedCostSource;

  @ApiProperty({
    description: 'Transaction UUIDs that led to detection (only for AUTO_DETECTED rows).',
    example: ['6b1f9cf2-3a7e-4d85-9f0b-6d2e0f1f1a02'],
    type: [String],
  })
  detectedFromTransactionIds!: string[];

  @ApiProperty({ description: 'ISO 8601 creation timestamp.', example: '2026-04-15T08:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ description: 'ISO 8601 last-update timestamp.', example: '2026-05-08T10:15:00.000Z' })
  updatedAt!: string;

  @ApiProperty({
    description: '1:1 contract extension — populated when the row was promoted to a tracked contract.',
    type: () => ContractResponse,
    nullable: true,
  })
  contract!: ContractResponse | null;
}
