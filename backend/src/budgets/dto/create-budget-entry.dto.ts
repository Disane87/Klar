import { IsString, IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBudgetEntryDto {
  @ApiProperty({ example: 'Netflix Subscription' })
  @IsString()
  name: string;

  @ApiProperty({ example: 15.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ example: 2026 })
  @IsNumber()
  year: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  householdId?: string;
}
