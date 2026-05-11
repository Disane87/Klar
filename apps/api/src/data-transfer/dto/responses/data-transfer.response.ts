import { ApiProperty } from '@nestjs/swagger';

export class AnalyzeSummaryResponse {
  @ApiProperty({ description: 'Number of transactions in the file.', example: 1843 })
  transactions!: number;

  @ApiProperty({ description: 'Number of recurring transactions in the file.', example: 27 })
  recurringTransactions!: number;
}

export class AnalyzeMappingSourceCategoryResponse {
  @ApiProperty({ example: 'Lebensmittel' })
  name!: string;

  @ApiProperty({ enum: ['EXPENSE', 'INCOME', 'FIXED_INCOME'], example: 'EXPENSE' })
  type!: string;
}

export class AnalyzeCategoryMappingResponse {
  @ApiProperty({ type: () => AnalyzeMappingSourceCategoryResponse })
  source!: AnalyzeMappingSourceCategoryResponse;

  @ApiProperty({ description: 'Auto-resolved local category ID, or null if user must pick.', example: 'cat_2a8d-...', nullable: true })
  resolvedId!: string | null;
}

export class AnalyzeProjectSourceResponse {
  @ApiProperty({ example: 'Hochzeit 2026' })
  name!: string;
}

export class AnalyzeProjectMappingResponse {
  @ApiProperty({ type: () => AnalyzeProjectSourceResponse })
  source!: AnalyzeProjectSourceResponse;

  @ApiProperty({ example: 'prj_2a8d-...', nullable: true })
  resolvedId!: string | null;
}

export class AvailableCategoryResponse {
  @ApiProperty({ example: 'cat_2a8d-...' })
  id!: string;

  @ApiProperty({ example: 'Lebensmittel' })
  name!: string;

  @ApiProperty({ enum: ['EXPENSE', 'INCOME', 'FIXED_INCOME'], example: 'EXPENSE' })
  type!: string;
}

export class AvailableProjectResponse {
  @ApiProperty({ example: 'prj_2a8d-...' })
  id!: string;

  @ApiProperty({ example: 'Hochzeit 2026' })
  name!: string;
}

export class AnalyzeResultResponse {
  @ApiProperty({ type: () => AnalyzeSummaryResponse })
  summary!: AnalyzeSummaryResponse;

  @ApiProperty({ type: () => [AnalyzeCategoryMappingResponse] })
  categoryMappings!: AnalyzeCategoryMappingResponse[];

  @ApiProperty({ type: () => [AnalyzeProjectMappingResponse] })
  projectMappings!: AnalyzeProjectMappingResponse[];

  @ApiProperty({ type: () => [AvailableCategoryResponse] })
  availableCategories!: AvailableCategoryResponse[];

  @ApiProperty({ type: () => [AvailableProjectResponse] })
  availableProjects!: AvailableProjectResponse[];
}

export class ImportResultCountersResponse {
  @ApiProperty({ example: 1840 })
  transactions!: number;

  @ApiProperty({ example: 27 })
  recurringTransactions!: number;
}

export class ImportResultResponse {
  @ApiProperty({ type: () => ImportResultCountersResponse })
  imported!: ImportResultCountersResponse;

  @ApiProperty({ description: 'Rows skipped because no mapping was provided or duplicate detected.', example: 3 })
  skipped!: number;
}
