import { ApiProperty } from '@nestjs/swagger';
import { FixedCostCycle, FixedCostStatus } from '@prisma/client';

export class CreateFixedCostDto {
  @ApiProperty({ description: 'Display name for this fixed cost.', example: 'Netflix Standard' })
  name!: string;

  @ApiProperty({
    description: 'Counterparty / merchant string as it appears on the bank statement.',
    example: 'NETFLIX.COM',
    required: false,
    nullable: true,
  })
  merchant?: string | null;

  @ApiProperty({
    description: 'Optional category UUID for budgeting.',
    example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
    required: false,
    nullable: true,
  })
  categoryId?: string | null;

  @ApiProperty({
    description: 'Amount in cents (signed integer; negative = recurring expense).',
    example: -1799,
  })
  amountCents!: number;

  @ApiProperty({
    description: 'Billing cycle.',
    enum: FixedCostCycle,
    example: FixedCostCycle.MONTHLY,
  })
  cycle!: FixedCostCycle;

  @ApiProperty({
    description: 'Next renewal/booking date (`YYYY-MM-DD`).',
    example: '2026-06-01',
    required: false,
    nullable: true,
  })
  nextRenewalAt?: string | null;

  @ApiProperty({
    description: 'Initial status — typically `CONFIRMED` for manual rows.',
    enum: FixedCostStatus,
    example: FixedCostStatus.CONFIRMED,
    required: false,
  })
  status?: FixedCostStatus;
}

export class UpdateFixedCostDto extends CreateFixedCostDto {}

export class BulkStatusDto {
  @ApiProperty({
    description: 'Fixed-cost UUIDs to update.',
    example: ['fc_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02'],
    type: [String],
  })
  ids!: string[];

  @ApiProperty({
    description: 'New status to apply to every row.',
    enum: FixedCostStatus,
    example: FixedCostStatus.CONFIRMED,
  })
  status!: FixedCostStatus;
}

export class PromoteToContractDto {
  @ApiProperty({
    description: 'Cancellation deadline (`YYYY-MM-DD`).',
    example: '2026-12-31',
    required: false,
    nullable: true,
  })
  cancelByAt?: string | null;

  @ApiProperty({
    description: 'Date when the contract started (`YYYY-MM-DD`).',
    example: '2024-01-15',
    required: false,
    nullable: true,
  })
  contractStartedAt?: string | null;

  @ApiProperty({
    description: 'Name of the household member holding the contract.',
    example: 'Marco Franke',
    required: false,
    nullable: true,
  })
  contractHolder?: string | null;

  @ApiProperty({
    description: 'Provider-issued contract number.',
    example: 'NFX-2024-58721',
    required: false,
    nullable: true,
  })
  contractNumber?: string | null;

  @ApiProperty({
    description: 'Provider name.',
    example: 'Netflix International B.V.',
    required: false,
    nullable: true,
  })
  providerName?: string | null;

  @ApiProperty({
    description: 'Optional URL to the stored contract PDF / scan.',
    example: 'https://files.your-klar-instance.com/contracts/netflix-2024.pdf',
    required: false,
    nullable: true,
  })
  documentUrl?: string | null;

  @ApiProperty({
    description: 'Free-text notes.',
    example: 'Auto-renewal alle 12 Monate; Kündigung bis Ende des Vertragsmonats.',
    required: false,
    nullable: true,
  })
  notes?: string | null;
}

export class UpdateContractDto extends PromoteToContractDto {}

export class RecomputeResponse {
  @ApiProperty({ description: 'Number of newly created CANDIDATE rows.', example: 7 })
  created!: number;

  @ApiProperty({ description: 'Number of stale CANDIDATE rows replaced.', example: 4 })
  replaced!: number;
}

export class BulkUpdateCountResponse {
  @ApiProperty({ description: 'Number of rows updated.', example: 3 })
  count!: number;
}
