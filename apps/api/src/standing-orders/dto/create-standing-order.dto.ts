import { ApiProperty } from '@nestjs/swagger';
import { StandingOrderFrequency } from '@prisma/client';

export class CreateStandingOrderDto {
  @ApiProperty({
    description: 'Account UUID this standing order is debited from / credited to.',
    example: 'acc_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
  })
  accountId!: string;

  @ApiProperty({
    description: 'Counterparty display name.',
    example: 'Sparkasse Köln-Bonn — Miete',
    required: false,
    nullable: true,
  })
  counterpartyName?: string | null;

  @ApiProperty({
    description: 'Counterparty IBAN.',
    example: 'DE89370400440532013000',
    required: false,
    nullable: true,
  })
  counterpartyIban?: string | null;

  @ApiProperty({
    description: 'Amount in cents (signed integer).',
    example: -85000,
  })
  amountCents!: number;

  @ApiProperty({ description: 'ISO 4217 currency code.', example: 'EUR', required: false })
  currency?: string;

  @ApiProperty({
    description: 'Recurrence frequency.',
    enum: StandingOrderFrequency,
    example: StandingOrderFrequency.MONTHLY,
  })
  frequency!: StandingOrderFrequency;

  @ApiProperty({
    description: 'Next expected execution date (`YYYY-MM-DD`).',
    example: '2026-06-01',
    required: false,
    nullable: true,
  })
  nextExpectedAt?: string | null;

  @ApiProperty({
    description: 'Optional category UUID for budgeting.',
    example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
    required: false,
    nullable: true,
  })
  categoryId?: string | null;

  @ApiProperty({
    description: 'Optional free-text note.',
    example: 'Kaltmiete inkl. Stellplatz',
    required: false,
    nullable: true,
  })
  note?: string | null;
}

export class UpdateStandingOrderDto {
  @ApiProperty({ description: 'Optional category UUID.', example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02', required: false, nullable: true })
  categoryId?: string | null;

  @ApiProperty({ description: 'Optional note.', example: 'Kaltmiete inkl. Stellplatz', required: false, nullable: true })
  note?: string | null;

  @ApiProperty({ description: 'Active flag.', example: true, required: false })
  isActive?: boolean;

  @ApiProperty({
    description: 'Counterparty name. Locked on `FINTS_DERIVED` rows.',
    example: 'Sparkasse Köln-Bonn — Miete',
    required: false,
    nullable: true,
  })
  counterpartyName?: string | null;

  @ApiProperty({
    description: 'Counterparty IBAN. Locked on `FINTS_DERIVED` rows.',
    example: 'DE89370400440532013000',
    required: false,
    nullable: true,
  })
  counterpartyIban?: string | null;

  @ApiProperty({
    description: 'Amount in cents. Locked on `FINTS_DERIVED` rows.',
    example: -85000,
    required: false,
  })
  amountCents?: number;

  @ApiProperty({
    description: 'Recurrence frequency. Locked on `FINTS_DERIVED` rows.',
    enum: StandingOrderFrequency,
    example: StandingOrderFrequency.MONTHLY,
    required: false,
  })
  frequency?: StandingOrderFrequency;

  @ApiProperty({
    description: 'Next expected execution date. Locked on `FINTS_DERIVED` rows.',
    example: '2026-06-01',
    required: false,
    nullable: true,
  })
  nextExpectedAt?: string | null;
}
