export type RecurringFrequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM_DAYS';

export function safeDayOfMonth(year: number, month: number, day: number): number {
  // month is 1-based (1=January, 12=December).
  // new Date(year, month, 0) gives the last day of that month:
  //   e.g. new Date(2024, 2, 0) = last day of February 2024 = 29
  const lastDay = new Date(year, month, 0).getDate();
  return Math.min(day, lastDay);
}

export function toMonthlyEquivalent(
  amountCents: number,
  freq: RecurringFrequency,
): number {
  switch (freq) {
    case 'MONTHLY':     return amountCents;
    case 'QUARTERLY':   return Math.round(amountCents / 3);
    case 'YEARLY':      return Math.round(amountCents / 12);
    case 'CUSTOM_DAYS': return amountCents;
  }
}

export function sumByCents(items: { amountCents: number }[]): number {
  return items.reduce((sum, item) => sum + item.amountCents, 0);
}

export function currentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
