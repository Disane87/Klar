import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';

export class CategoryResponse {
  @ApiProperty({ description: 'Category ID (UUID).', example: 'cat_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  id!: string;

  @ApiProperty({ description: 'Household this category belongs to.', example: 'hh_2a8d3e1f-7b21-4f1c-9c0e-3d2e0f1f1a02' })
  householdId!: string;

  @ApiProperty({ description: 'Display name.', example: 'Lebensmittel' })
  name!: string;

  @ApiProperty({ description: 'Category type.', enum: CategoryType, example: CategoryType.VARIABLE_EXPENSE })
  type!: CategoryType;

  @ApiProperty({ description: 'Hex accent color.', example: '#fb923c' })
  color!: string;

  @ApiProperty({ description: 'Lucide icon slug.', example: 'shopping-cart', nullable: true })
  icon!: string | null;

  @ApiProperty({ description: 'Whether the category is soft-archived.', example: false })
  isArchived!: boolean;

  @ApiProperty({ description: 'Sort order in the UI.', example: 20 })
  sortOrder!: number;

  @ApiProperty({
    description: 'Whether this is one of the seeded default categories.',
    example: true,
  })
  isDefault!: boolean;

  @ApiProperty({ description: 'ISO 8601 creation timestamp.', example: '2026-04-01T08:30:00.000Z' })
  createdAt!: string;
}
