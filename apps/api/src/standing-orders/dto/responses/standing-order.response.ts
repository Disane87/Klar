import { ApiProperty } from '@nestjs/swagger';
import { StandingOrderFrequency } from '@prisma/client';

export class StandingOrderResponse {
  @ApiProperty({ description: 'Standing-order ID (UUID).', example: 'so_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  id!: string;

  @ApiProperty({ description: 'Household this row belongs to.', example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  householdId!: string;

  @ApiProperty({ description: 'Account this standing order is booked on.', example: 'acc_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  accountId!: string;

  @ApiProperty({
    description: 'Stable group key — "manual:..." for user-entered rows, "counterparty|amount" for FinTS-derived rows.',
    example: 'manual:sparkasse köln-bonn — miete|-85000|1715166000000',
  })
  groupKey!: string;

  @ApiProperty({
    description: 'Origin: `MANUAL` or `FINTS_DERIVED`. Bank-derived rows have several fields locked.',
    enum: ['MANUAL', 'FINTS_DERIVED'],
    example: 'FINTS_DERIVED',
  })
  source!: string;

  @ApiProperty({ description: 'Counterparty name.', example: 'Sparkasse Köln-Bonn — Miete', nullable: true })
  counterpartyName!: string | null;

  @ApiProperty({ description: 'Counterparty IBAN.', example: 'DE89370400440532013000', nullable: true })
  counterpartyIban!: string | null;

  @ApiProperty({ description: 'Amount in cents (signed).', example: -85000 })
  amountCents!: number;

  @ApiProperty({ description: 'ISO 4217 currency code.', example: 'EUR' })
  currency!: string;

  @ApiProperty({ description: 'Recurrence frequency.', enum: StandingOrderFrequency, example: StandingOrderFrequency.MONTHLY })
  frequency!: StandingOrderFrequency;

  @ApiProperty({ description: 'Next expected execution date (ISO 8601).', example: '2026-06-01T00:00:00.000Z', nullable: true })
  nextExpectedAt!: string | null;

  @ApiProperty({ description: 'Optional category UUID.', example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02', nullable: true })
  categoryId!: string | null;

  @ApiProperty({ description: 'Optional free-text note.', example: 'Kaltmiete inkl. Stellplatz', nullable: true })
  note!: string | null;

  @ApiProperty({ description: 'Whether the standing order is currently active.', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'ISO 8601 creation timestamp.', example: '2026-04-15T08:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ description: 'ISO 8601 last-update timestamp.', example: '2026-05-08T10:15:00.000Z' })
  updatedAt!: string;
}
