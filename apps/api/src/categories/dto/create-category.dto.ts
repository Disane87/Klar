import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Display name (1..100 chars).', example: 'Lebensmittel' })
  name!: string;

  @ApiProperty({
    description:
      'Category type — drives whether expenses or income roll up into the category. `FIXED_EXPENSE` covers rent/insurance/subscriptions, `VARIABLE_EXPENSE` covers everyday spend.',
    enum: CategoryType,
    example: CategoryType.VARIABLE_EXPENSE,
  })
  type!: CategoryType;

  @ApiProperty({ description: 'Hex accent color, e.g. `#fb923c`.', example: '#fb923c' })
  color!: string;

  @ApiProperty({ description: 'Optional Lucide icon slug.', example: 'shopping-cart', required: false, nullable: true })
  icon?: string | null;

  @ApiProperty({ description: 'Sort order for the UI list.', example: 20, required: false })
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @ApiProperty({ description: 'Display name (1..100 chars).', example: 'Lebensmittel & Drogerie', required: false })
  name?: string;

  @ApiProperty({ description: 'Hex accent color.', example: '#fb923c', required: false })
  color?: string;

  @ApiProperty({ description: 'Optional Lucide icon slug.', example: 'shopping-cart', required: false, nullable: true })
  icon?: string | null;

  @ApiProperty({ description: 'Sort order.', example: 20, required: false })
  sortOrder?: number;

  @ApiProperty({
    description:
      'Soft-delete marker. Categories with attached transactions are auto-archived on DELETE; this flag lets you un-archive.',
    example: false,
    required: false,
  })
  isArchived?: boolean;
}
