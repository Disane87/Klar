import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  Bundesland,
  GrossPeriod,
  Krankenversicherung,
  PayrollCalculatorState,
  RentenversicherungRegion,
  Steuerklasse,
} from '@klar/shared';

const BUNDESLAENDER: Bundesland[] = [
  'BW','BY','BE','BB','HB','HH','HE','MV','NI','NW','RP','SL','SN','ST','SH','TH',
];

export class PayrollPositionDto {
  @ApiProperty({ description: 'Stable client-side identifier.', example: 'pos-1734000000000-1' })
  @IsString()
  @MaxLength(64)
  id!: string;

  @ApiProperty({ description: 'Display name (e.g. "Festgehalt", "Provision").', example: 'Festgehalt' })
  @IsString()
  @MaxLength(120)
  label!: string;

  @ApiProperty({ description: 'Signed integer cents in the selected period.', example: 400000 })
  @IsInt()
  amountCents!: number;
}

export class PayrollCalculatorStateDto implements PayrollCalculatorState {
  @ApiProperty({ type: [PayrollPositionDto], required: false, description: 'Lohnzettel line items.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PayrollPositionDto)
  positions?: PayrollPositionDto[];

  @ApiProperty({ enum: ['monthly', 'yearly'], required: false, example: 'monthly' })
  @IsOptional()
  @IsIn(['monthly', 'yearly'])
  period?: GrossPeriod;

  @ApiProperty({ enum: [1, 2, 3, 4, 5, 6], required: false, example: 1 })
  @IsOptional()
  @IsIn([1, 2, 3, 4, 5, 6])
  steuerklasse?: Steuerklasse;

  @ApiProperty({ enum: BUNDESLAENDER, required: false, example: 'NW' })
  @IsOptional()
  @IsIn(BUNDESLAENDER)
  bundesland?: Bundesland;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  kirchensteuer?: boolean;

  @ApiProperty({ required: false, example: 1990, minimum: 1900, maximum: 2100 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  birthYear?: number;

  @ApiProperty({ required: false, example: 0, minimum: 0, maximum: 8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(8)
  kinderfreibetraege?: number;

  @ApiProperty({ enum: ['gesetzlich', 'privat'], required: false, example: 'gesetzlich' })
  @IsOptional()
  @IsIn(['gesetzlich', 'privat'])
  krankenversicherung?: Krankenversicherung;

  @ApiProperty({ required: false, example: 'tk' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  krankenkasseId?: string;

  @ApiProperty({ required: false, example: 2.69, minimum: 0, maximum: 20 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  kvZusatzbeitragPct?: number;

  @ApiProperty({ required: false, nullable: true, example: null })
  @IsOptional()
  @IsInt()
  pkvBeitragMonthlyCents?: number | null;

  @ApiProperty({ enum: ['west', 'ost'], required: false, example: 'west' })
  @IsOptional()
  @IsIn(['west', 'ost'])
  rentenversicherungRegion?: RentenversicherungRegion;

  @ApiProperty({ required: false, nullable: true, example: 0 })
  @IsOptional()
  @IsInt()
  geldwerterVorteilMonthlyCents?: number | null;

  @ApiProperty({ required: false, nullable: true, example: 0 })
  @IsOptional()
  @IsInt()
  lohnsteuerFreibetragYearlyCents?: number | null;
}
