import { IsString, IsNumber, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIncomeDto {
  @ApiProperty({ example: 'Monthly Salary' })
  @IsString()
  name: string;

  @ApiProperty({ example: 3500.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

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
