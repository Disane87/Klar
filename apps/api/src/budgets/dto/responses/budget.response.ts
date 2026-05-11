import { ApiProperty } from '@nestjs/swagger';

export class BudgetResponse {
  @ApiProperty({ description: 'Budget ID (UUID).', example: 'bd_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  id!: string;

  @ApiProperty({ description: 'Household this budget belongs to.', example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  householdId!: string;

  @ApiProperty({ description: 'Category this budget targets.', example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  categoryId!: string;

  @ApiProperty({
    description: 'Normalized budget month (`YYYY-MM-01`).',
    example: '2026-05-01',
  })
  month!: string;

  @ApiProperty({
    description: 'Budget amount in cents (positive integer).',
    example: 50000,
  })
  amountCents!: number;

  @ApiProperty({ description: 'ISO 8601 creation timestamp.', example: '2026-04-15T08:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ description: 'ISO 8601 last-update timestamp.', example: '2026-05-08T10:15:00.000Z' })
  updatedAt!: string;
}
