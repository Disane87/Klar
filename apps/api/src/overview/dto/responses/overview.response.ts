import { ApiProperty } from '@nestjs/swagger';

export class FixedCostsSplitResponse {
  @ApiProperty({ example: 'sp_1a2b' })
  id!: string;

  @ApiProperty({ example: 'Brutto' })
  label!: string;

  @ApiProperty({ description: 'Signed amount in cents.', example: 380000 })
  amountCents!: number;

  @ApiProperty({ example: 0 })
  sortOrder!: number;
}

export class FixedCostsItemResponse {
  @ApiProperty({ example: 'rec_2a8d-...' })
  id!: string;

  @ApiProperty({ example: 'cat_2a8d-...' })
  categoryId!: string;

  @ApiProperty({ example: 'Netflix' })
  name!: string;

  @ApiProperty({ description: 'Signed amount in cents (configured frequency).', example: -2499 })
  amountCents!: number;

  @ApiProperty({ description: 'Normalized monthly amount in cents.', example: -2499 })
  monthlyEquivalentCents!: number;

  @ApiProperty({ enum: ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'WEEKLY'], example: 'MONTHLY' })
  frequency!: string;

  @ApiProperty({ description: 'True for variable costs (groceries-style estimates).', example: false })
  isVariable!: boolean;

  @ApiProperty({ description: 'Configured day of month (1–31, clamped to month length on output).', example: 4, nullable: true })
  dayOfMonth!: number | null;

  @ApiProperty({ description: 'Display name of the user who created it.', example: 'Marco', nullable: true })
  createdBy!: string | null;

  @ApiProperty({ example: 'usr_3f8e-...', nullable: true })
  createdById!: string | null;

  @ApiProperty({ example: '#ff7849', nullable: true })
  color!: string | null;

  @ApiProperty({ example: 'tv', nullable: true })
  icon!: string | null;

  @ApiProperty({ type: () => [FixedCostsSplitResponse] })
  splits!: FixedCostsSplitResponse[];
}

export class FixedCostsGroupResponse {
  @ApiProperty({ example: 'cat_2a8d-...' })
  categoryId!: string;

  @ApiProperty({ example: 'Streaming' })
  categoryName!: string;

  @ApiProperty({ example: '#ff7849' })
  categoryColor!: string;

  @ApiProperty({ example: 'tv', nullable: true })
  categoryIcon!: string | null;

  @ApiProperty({ enum: ['EXPENSE', 'INCOME'], example: 'EXPENSE' })
  categoryType!: string;

  @ApiProperty({ example: 10 })
  categorySortOrder!: number;

  @ApiProperty({ description: 'Sum of monthlyEquivalentCents in this group (signed).', example: -7497 })
  totalCents!: number;

  @ApiProperty({ type: () => [FixedCostsItemResponse] })
  items!: FixedCostsItemResponse[];
}

export class FixedCostsResponse {
  @ApiProperty({ description: 'Month in YYYY-MM form.', example: '2026-05' })
  month!: string;

  @ApiProperty({ description: 'Sum of monthlyEquivalentCents across all groups (signed).', example: -213450 })
  totalCents!: number;

  @ApiProperty({ type: () => [FixedCostsGroupResponse] })
  groups!: FixedCostsGroupResponse[];
}

export class CashflowResponse {
  @ApiProperty({ example: '2026-05' })
  month!: string;

  @ApiProperty({ description: 'Sum of monthly-equivalent income from recurring transactions (cents).', example: 285000 })
  recurringIncomeCents!: number;

  @ApiProperty({ description: 'Sum of monthly-equivalent expenses from recurring transactions (cents, negative).', example: -213450 })
  recurringExpensesCents!: number;

  @ApiProperty({ description: 'Ad-hoc booked income in the month (cents).', example: 12000 })
  transactionIncomeCents!: number;

  @ApiProperty({ description: 'Ad-hoc booked expenses in the month (cents, negative).', example: -45000 })
  transactionExpensesCents!: number;

  @ApiProperty({ example: 297000 })
  totalIncomeCents!: number;

  @ApiProperty({ example: -258450 })
  totalExpensesCents!: number;

  @ApiProperty({ description: 'Net cashflow (income + expenses, signed).', example: 38550 })
  surplusCents!: number;
}

export class ProjectOverviewItemResponse {
  @ApiProperty({ example: 'prj_2a8d-...' })
  id!: string;

  @ApiProperty({ example: 'Hochzeit 2026' })
  name!: string;

  @ApiProperty({ example: '#ff7849' })
  color!: string;

  @ApiProperty({ enum: ['ACTIVE', 'ARCHIVED', 'PLANNED'], example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ description: 'Total budget in cents (positive), null if no budget set.', example: 1500000, nullable: true })
  totalBudgetCents!: number | null;

  @ApiProperty({ description: 'Realized spend in cents (negative).', example: -240000 })
  spentCents!: number;

  @ApiProperty({ description: 'Realized income in cents.', example: 50000 })
  incomeCents!: number;

  @ApiProperty({ description: 'incomeCents + spentCents (signed).', example: -190000 })
  balanceCents!: number;

  @ApiProperty({ description: 'Sum of planned-only expenses (cents).', example: -180000 })
  plannedSpentCents!: number;

  @ApiProperty({ description: 'Sum of planned-only income (cents).', example: 0 })
  plannedIncomeCents!: number;

  @ApiProperty({ description: 'Sum of (amountCents − plannedAmountCents) for plans that were realized.', example: -4500 })
  deviationCents!: number;

  @ApiProperty({ example: 18 })
  transactionCount!: number;
}

export class ProjectsOverviewResponse {
  @ApiProperty({ type: () => [ProjectOverviewItemResponse] })
  projects!: ProjectOverviewItemResponse[];
}

export class BudgetVsActualRowResponse {
  @ApiProperty({ example: 'cat_2a8d-...' })
  categoryId!: string;

  @ApiProperty({ example: 'Lebensmittel' })
  categoryName!: string;

  @ApiProperty({ description: 'Budget target in cents (signed).', example: -45000 })
  budgetCents!: number;

  @ApiProperty({ description: 'Actuals (recurring + transactions) in cents (signed).', example: -47200 })
  actualCents!: number;

  @ApiProperty({ description: 'actual − budget (signed).', example: -2200 })
  deltaCents!: number;
}

export class BudgetsVsActualsResponse {
  @ApiProperty({ example: '2026-05' })
  month!: string;

  @ApiProperty({ type: () => [BudgetVsActualRowResponse] })
  rows!: BudgetVsActualRowResponse[];
}
