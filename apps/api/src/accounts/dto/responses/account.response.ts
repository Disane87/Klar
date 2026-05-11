import { ApiProperty } from '@nestjs/swagger';

export class AccountResponse {
  @ApiProperty({
    description: 'Account ID (UUID v4).',
    example: 'acc_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
  })
  id!: string;

  @ApiProperty({
    description: 'Household this account belongs to.',
    example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
  })
  householdId!: string;

  @ApiProperty({
    description:
      'Owning user (set for FinTS accounts whose credentials are tied to a single user). `null` for shared csv_only accounts.',
    example: 'usr_8c1f4d92-5e62-4f4a-8b80-2a1d3c4e5f6a',
    nullable: true,
  })
  ownerId!: string | null;

  @ApiProperty({ description: 'Display name.', example: 'Girokonto Sparkasse' })
  name!: string;

  @ApiProperty({
    description: 'Account type. `csv_only` for manual/CSV imports, `fints` for connected bank accounts.',
    enum: ['csv_only', 'fints'],
    example: 'fints',
  })
  type!: string;

  @ApiProperty({ description: 'ISO 4217 currency code.', example: 'EUR' })
  currency!: string;

  @ApiProperty({
    description: 'IBAN (only set for FinTS accounts).',
    example: 'DE89370400440532013000',
    nullable: true,
  })
  iban!: string | null;

  @ApiProperty({
    description: 'BIC (only set for FinTS accounts).',
    example: 'COBADEFFXXX',
    nullable: true,
  })
  bic!: string | null;

  @ApiProperty({
    description: 'Visibility scope inside the household.',
    enum: ['SHARED', 'PRIVATE'],
    example: 'SHARED',
  })
  visibility!: 'SHARED' | 'PRIVATE';

  @ApiProperty({
    description: 'ISO 8601 timestamp when the account was archived, or `null`.',
    example: null,
    nullable: true,
  })
  archivedAt!: string | null;

  @ApiProperty({
    description: 'Whether automatic FinTS sync is enabled.',
    example: true,
  })
  syncEnabled!: boolean;

  @ApiProperty({ description: 'ISO 8601 creation timestamp.', example: '2026-04-01T08:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ description: 'ISO 8601 last-update timestamp.', example: '2026-05-08T10:15:00.000Z' })
  updatedAt!: string;
}
