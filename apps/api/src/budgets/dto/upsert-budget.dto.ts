import { ApiProperty } from '@nestjs/swagger';

export class UpsertBudgetDto {
  @ApiProperty({
    description: 'Category UUID this budget targets.',
    example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02',
  })
  categoryId!: string;

  @ApiProperty({
    description:
      'Budget month — accepted as `YYYY-MM` or `YYYY-MM-DD`, normalized server-side to `YYYY-MM-01`.',
    example: '2026-05',
  })
  month!: string;

  @ApiProperty({
    description: 'Budget amount in cents (positive integer).',
    example: 50000,
  })
  amountCents!: number;
}
