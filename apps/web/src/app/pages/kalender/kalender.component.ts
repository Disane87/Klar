import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import type { Transaction } from '../../core/transactions/transactions.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { PageHeaderService } from '../../core/page-header/page-header.service';

interface DayCell {
  /** ISO YYYY-MM-DD */
  iso: string;
  /** Numeric day-of-month (1..31). 0 = filler before/after month. */
  day: number;
  inMonth: boolean;
  isToday: boolean;
  totalCents: number;
  transactions: Transaction[];
  /** Up to 3 distinct category colors for the dot row. */
  dotColors: string[];
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

@Component({
  selector: 'klar-kalender-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, KlarMoneyPipe, KlarIconComponent],
  template: `
    <div class="flex flex-col gap-(--s-4) p-(--s-6) pb-16">
      <!-- Toolbar -->
      <div class="flex items-center justify-between gap-(--s-3)">
        <div class="flex items-center gap-2">
          <button class="btn icon-only" type="button" (click)="prevMonth()" aria-label="Vorheriger Monat">
            <klar-icon name="chevron-left" [size]="14" />
          </button>
          <span
            class="text-[18px] font-medium leading-none"
            style="font-family: var(--font-display); letter-spacing: -0.02em;"
          >
            {{ monthLabel() }}
          </span>
          <button class="btn icon-only" type="button" (click)="nextMonth()" aria-label="Nächster Monat">
            <klar-icon name="chevron-right" [size]="14" />
          </button>
          <button class="btn ghost text-[11px]" type="button" (click)="goToday()">heute</button>
        </div>
        <div class="hidden sm:flex items-center gap-3 text-[11px] text-(--fg-2) mono">
          <span><span class="text-(--success) mr-1">+</span>{{ totalIncomeCents() | klarMoney }}</span>
          <span><span class="text-(--danger) mr-1">−</span>{{ totalExpenseCents() | klarMoney }}</span>
        </div>
      </div>

      <!-- Weekday header -->
      <div class="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-[0.14em] text-(--fg-3)">
        @for (d of weekdays; track d) {
          <span class="px-2">{{ d }}</span>
        }
      </div>

      <!-- Calendar grid -->
      <div class="grid grid-cols-7 gap-1">
        @for (cell of cells(); track cell.iso) {
          <button
            type="button"
            class="relative aspect-square rounded-md border bg-(--bg-1) flex flex-col items-stretch p-1.5 transition-colors hover:bg-(--bg-2) text-left disabled:opacity-30"
            [class.opacity-50]="!cell.inMonth"
            [class.border-(--accent)]="cell.isToday"
            [class.border-(--line-soft)]="!cell.isToday"
            [attr.aria-label]="'Tag ' + cell.day"
            [attr.aria-pressed]="selectedIso() === cell.iso"
            [class.bg-(--accent-soft)]="selectedIso() === cell.iso"
            (click)="selectDay(cell)"
          >
            <span
              class="text-[12px] mono leading-none self-end"
              [class.text-(--accent)]="cell.isToday"
              [class.text-(--fg)]="!cell.isToday"
            >{{ cell.day || '' }}</span>
            <span class="flex-1"></span>
            @if (cell.transactions.length > 0) {
              <div class="flex flex-wrap gap-0.5">
                @for (color of cell.dotColors; track $index) {
                  <span class="size-1.5 rounded-full" [style.background]="color" aria-hidden="true"></span>
                }
                @if (cell.transactions.length > cell.dotColors.length) {
                  <span class="text-[8px] text-(--fg-3) leading-none mono">
                    +{{ cell.transactions.length - cell.dotColors.length }}
                  </span>
                }
              </div>
              <span
                class="text-[9px] mono leading-none mt-0.5 truncate"
                [style.color]="cell.totalCents < 0 ? 'var(--danger)' : 'var(--success)'"
              >
                {{ cell.totalCents | klarMoney }}
              </span>
            }
          </button>
        }
      </div>

      <!-- Day drawer -->
      @if (selectedIso(); as iso) {
        <section class="rounded-lg border border-(--line) bg-(--bg-1) overflow-hidden">
          <header class="flex items-center justify-between px-4 py-3 border-b border-(--line-soft)">
            <div class="flex flex-col">
              <span class="eyebrow">Tag</span>
              <span
                class="text-[16px] font-medium leading-none"
                style="font-family: var(--font-display); letter-spacing: -0.02em;"
              >{{ iso | date:'EEEE, dd. MMMM yyyy' }}</span>
            </div>
            <span class="mono text-[14px]" [style.color]="dayTotalCents() < 0 ? 'var(--danger)' : 'var(--success)'">
              {{ dayTotalCents() | klarMoney }}
            </span>
          </header>
          @if (dayTransactions().length === 0) {
            <div class="px-4 py-6 text-center text-(--fg-2) text-[12px]">
              Keine Buchungen an diesem Tag.
            </div>
          } @else {
            <ul>
              @for (t of dayTransactions(); track t.id) {
                <li
                  class="cat-bar px-4 py-2.5 flex items-center gap-3 border-b border-(--line-soft) last:border-b-0"
                  [style.--cat-color]="categoryColor(t.categoryId)"
                >
                  <div class="flex-1 min-w-0">
                    <div class="text-[13px] truncate">{{ t.description || '—' }}</div>
                    <div class="text-[11px] text-(--fg-2) truncate">
                      {{ categoryName(t.categoryId) || 'Unkategorisiert' }}
                    </div>
                  </div>
                  <span class="mono text-[13px]" [style.color]="t.amountCents < 0 ? 'var(--danger)' : 'var(--success)'">
                    {{ t.amountCents | klarMoney }}
                  </span>
                </li>
              }
            </ul>
          }
        </section>
      }
    </div>
  `,
})
export class KalenderComponent implements OnInit {
  protected readonly txStore = inject(TransactionsStore);
  protected readonly catStore = inject(CategoriesStore);
  private readonly pageHeader = inject(PageHeaderService);

  protected readonly weekdays = WEEKDAYS;
  protected readonly selectedIso = signal<string | null>(null);

  protected readonly monthLabel = computed(() => {
    const [year, month] = this.txStore.currentMonth().split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('de-DE', {
      month: 'long',
      year: 'numeric',
    });
  });

  protected readonly cells = computed<DayCell[]>(() => {
    const [year, month] = this.txStore.currentMonth().split('-').map(Number);
    const firstOfMonth = new Date(year, month - 1, 1);
    const lastOfMonth = new Date(year, month, 0);
    const todayIso = this.todayIso();

    // Monday-based offset (Mon=0..Sun=6)
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const totalDays = lastOfMonth.getDate();
    const totalCells = Math.ceil((firstWeekday + totalDays) / 7) * 7;

    const items = this.txStore.items() ?? [];
    const byDate = new Map<string, Transaction[]>();
    for (const t of items) {
      const arr = byDate.get(t.date) ?? [];
      arr.push(t);
      byDate.set(t.date, arr);
    }

    const cells: DayCell[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstWeekday + 1;
      const inMonth = dayNum >= 1 && dayNum <= totalDays;
      const date = inMonth
        ? new Date(year, month - 1, dayNum)
        : new Date(year, month - 1, dayNum); // synthesised for filler
      const iso = this.toIso(date);
      const transactions = inMonth ? (byDate.get(iso) ?? []) : [];
      const totalCents = transactions.reduce((sum, t) => sum + t.amountCents, 0);
      const dotColors = this.distinctColorsFor(transactions, 3);
      cells.push({
        iso,
        day: inMonth ? dayNum : 0,
        inMonth,
        isToday: inMonth && iso === todayIso,
        totalCents,
        transactions,
        dotColors,
      });
    }
    return cells;
  });

  protected readonly totalIncomeCents = computed(() =>
    (this.txStore.items() ?? []).filter(t => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0),
  );
  protected readonly totalExpenseCents = computed(() =>
    (this.txStore.items() ?? []).filter(t => t.amountCents < 0).reduce((s, t) => s + t.amountCents, 0),
  );

  protected readonly dayTransactions = computed<Transaction[]>(() => {
    const iso = this.selectedIso();
    if (!iso) return [];
    return (this.txStore.items() ?? []).filter(t => t.date === iso);
  });
  protected readonly dayTotalCents = computed(() =>
    this.dayTransactions().reduce((s, t) => s + t.amountCents, 0),
  );

  ngOnInit(): void {
    this.pageHeader.set({ title: 'Kalender', subtitle: 'Buchungen pro Tag' });
  }

  protected selectDay(cell: DayCell): void {
    if (!cell.inMonth) return;
    this.selectedIso.set(this.selectedIso() === cell.iso ? null : cell.iso);
  }

  protected prevMonth(): void {
    this.shiftMonth(-1);
  }

  protected nextMonth(): void {
    this.shiftMonth(1);
  }

  protected goToday(): void {
    const today = new Date();
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    this.txStore.currentMonth.set(ym);
    this.selectedIso.set(this.toIso(today));
  }

  protected categoryColor(id: string | null): string {
    if (!id) return 'var(--accent)';
    return this.catStore.byId(id)?.color ?? 'var(--accent)';
  }

  protected categoryName(id: string | null): string | null {
    if (!id) return null;
    return this.catStore.byId(id)?.name ?? null;
  }

  private shiftMonth(delta: number): void {
    const [y, m] = this.txStore.currentMonth().split('-').map(Number);
    const next = new Date(y, m - 1 + delta, 1);
    const ym = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    this.txStore.currentMonth.set(ym);
    this.selectedIso.set(null);
  }

  private todayIso(): string {
    return this.toIso(new Date());
  }

  private toIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private distinctColorsFor(items: Transaction[], max: number): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const t of items) {
      const color = this.categoryColor(t.categoryId);
      if (seen.has(color)) continue;
      seen.add(color);
      out.push(color);
      if (out.length >= max) break;
    }
    return out;
  }
}
