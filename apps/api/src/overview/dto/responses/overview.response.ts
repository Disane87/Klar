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

export class CashflowTopMoveResponse {
  @ApiProperty({ example: 'tx_2a8d-...' })
  id!: string;

  @ApiProperty({ example: '2026-05-05', description: 'ISO date YYYY-MM-DD.' })
  date!: string;

  @ApiProperty({ description: 'Signed cents (positive=income, negative=expense).', example: -181066 })
  amountCents!: number;

  @ApiProperty({ example: 'PayPal Europe S.a.r.l.', nullable: true })
  counterparty!: string | null;

  @ApiProperty({ example: 'Belvilla Services B.V., Holland Reise', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 'OTHER', nullable: true })
  transactionKind!: string | null;
}

export class CashflowInsightResponse {
  @ApiProperty({
    enum: ['transfer-excluded', 'folgelastschrift-spike', 'pace-warn', 'pace-ok'],
    example: 'transfer-excluded',
    description: 'Insight kind — drives the UI badge/colour.',
  })
  kind!: string;

  @ApiProperty({ example: 'Eigene Überträge', description: 'Short label shown next to the icon.' })
  label!: string;

  @ApiProperty({
    example: '4 Buchungen mit „Übertrag" wurden aus dem Cashflow ausgenommen (Summe +2300€).',
    description: 'Human-readable explanation.',
  })
  detail!: string;

  @ApiProperty({ example: 4, nullable: true, description: 'Optional count for the badge.' })
  count!: number | null;

  @ApiProperty({ example: 230000, nullable: true, description: 'Optional signed cents.' })
  amountCents!: number | null;
}

export class LiquidityUpcomingItemResponse {
  @ApiProperty({ example: '2026-05-15', description: 'ISO date YYYY-MM-DD when this item is due.' })
  date!: string;

  @ApiProperty({ example: 'Miete', description: 'Display label (FixedCost.name or RecurringTransaction.name).' })
  label!: string;

  @ApiProperty({ example: -125000, description: 'Signed cents. Negative for outflows, positive for inflows.' })
  amountCents!: number;

  @ApiProperty({ enum: ['fixed-cost', 'recurring'], example: 'fixed-cost' })
  kind!: 'fixed-cost' | 'recurring';
}

export class LiquidityForecastResponse {
  @ApiProperty({ example: 18, description: 'Days from today (inclusive) to EOM (inclusive).' })
  daysRemaining!: number;

  @ApiProperty({ example: 183400, description: 'Sum of last-known balances across accessible accounts (cents).' })
  currentLiquidityCents!: number;

  @ApiProperty({ example: 2, description: 'How many accounts contributed an actual balance.' })
  accountsWithBalance!: number;

  @ApiProperty({ example: 3, description: 'Total accessible accounts (including those without balance).' })
  accountsTotal!: number;

  @ApiProperty({ example: 250000, description: 'Sum of recurring income still expected in (today, EOM] (cents).' })
  expectedIncomeRemainingCents!: number;

  @ApiProperty({ example: 124700, description: 'Sum of pending CONFIRMED fixed costs in [today, EOM] (positive cents).' })
  pendingFixedCostsCents!: number;

  @ApiProperty({ example: 1900, description: 'Average daily variable spend over the last 30 days (positive cents).' })
  variableDailyAvgCents!: number;

  @ApiProperty({ example: 34200, description: '`variableDailyAvgCents × daysRemaining` (positive cents).' })
  variableForecastCents!: number;

  @ApiProperty({
    example: 124700,
    description:
      'Bottom line: currentLiquidity + expectedIncome − pendingFixed − variableForecast. Signed cents.',
  })
  forecastEomCents!: number;

  @ApiProperty({ enum: ['red', 'yellow', 'green'], example: 'green' })
  comfortZone!: 'red' | 'yellow' | 'green';

  @ApiProperty({ type: () => [LiquidityUpcomingItemResponse] })
  upcomingItems!: LiquidityUpcomingItemResponse[];
}

export class CashflowResponse {
  @ApiProperty({ example: '2026-05' })
  month!: string;

  @ApiProperty({ description: 'Sum of monthly-equivalent income from recurring transactions (cents).', example: 285000 })
  recurringIncomeCents!: number;

  @ApiProperty({ description: 'Sum of monthly-equivalent expenses from recurring transactions (cents, negative).', example: -213450 })
  recurringExpensesCents!: number;

  @ApiProperty({ description: 'Ad-hoc booked income in the month (cents). Excludes TRANSFER-kind rows.', example: 12000 })
  transactionIncomeCents!: number;

  @ApiProperty({ description: 'Ad-hoc booked expenses in the month (cents, negative). Excludes TRANSFER-kind rows.', example: -45000 })
  transactionExpensesCents!: number;

  @ApiProperty({ example: 297000 })
  totalIncomeCents!: number;

  @ApiProperty({ example: -258450 })
  totalExpensesCents!: number;

  @ApiProperty({ description: 'Net cashflow (income + expenses, signed).', example: 38550 })
  surplusCents!: number;

  // ── Insights v1 (Phase 2 of cashflow redesign) ────────────────────────────

  @ApiProperty({ example: 13, description: 'Day-of-month for the projection anchor.' })
  dayOfMonth!: number;

  @ApiProperty({ example: 31, description: 'Total days in the queried month.' })
  daysInMonth!: number;

  @ApiProperty({
    description:
      'Linear extrapolation of `surplusCents` to month-end based on the current pace. Null when the month is in the future or `dayOfMonth` is 0.',
    example: -715000,
    nullable: true,
  })
  projectedSurplusCents!: number | null;

  @ApiProperty({
    description: 'Surplus delta vs. the previous month (signed cents). Null when no prior data.',
    example: -42000,
    nullable: true,
  })
  surplusDeltaPrevMonthCents!: number | null;

  @ApiProperty({
    description: 'Top 5 largest expenses of the month, signed cents (most negative first). Excludes TRANSFER.',
    type: () => [CashflowTopMoveResponse],
  })
  topExpenses!: CashflowTopMoveResponse[];

  @ApiProperty({
    description: 'Top 3 largest incomes of the month (most positive first). Excludes TRANSFER.',
    type: () => [CashflowTopMoveResponse],
  })
  topIncome!: CashflowTopMoveResponse[];

  @ApiProperty({
    description: 'Optional contextual hints (TRANSFER count, Folgelastschrift spike, pacing warnings).',
    type: () => [CashflowInsightResponse],
  })
  insights!: CashflowInsightResponse[];
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
