import type { Transaction } from '../../core/transactions/transactions.store';

export interface MonthGroup {
  key: string;
  label: string;
  items: Transaction[];
  itemsCount: number;
  totalCents: number;
}

export function groupByMonth(items: readonly Transaction[]): MonthGroup[] {
  const sorted = [...items].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt.localeCompare(a.createdAt);
  });
  const buckets = new Map<string, Transaction[]>();
  for (const t of sorted) {
    const key = t.date.slice(0, 7);
    const arr = buckets.get(key) ?? [];
    arr.push(t);
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries()).map(([key, group]) => ({
    key,
    label: formatMonthLabel(key),
    items: group,
    itemsCount: group.length,
    totalCents: group.reduce((s, t) => s + t.amountCents, 0),
  }));
}

function formatMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return yearMonth;
  const date = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
