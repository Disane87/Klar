import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import type { Transaction } from '../../core/transactions/transactions.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarHeroComponent } from '../../shared/ui/klar-hero.component';
import { KlarTileComponent } from '../../shared/ui/klar-tile.component';
import { KlarMonthSelectComponent } from '../../shared/ui/klar-month-select.component';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KalenderDayDialogComponent } from './dialogs/kalender-day-dialog.component';

interface DayCell {
  /** ISO YYYY-MM-DD; '' for padding cells. */
  iso: string;
  /** Numeric day-of-month (1..31) or 0 for filler. */
  day: number;
  pad: boolean;
  isToday: boolean;
  isWeekend: boolean;
  totalCents: number;
  /** First three transactions for the cell (for pills). */
  pills: Transaction[];
  extraCount: number;
  txCount: number;
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

@Component({
  selector: 'klar-kalender-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlarIconComponent, KlarHeroComponent, KlarTileComponent, KlarMonthSelectComponent],
  // Take full remaining viewport height inside the shell flex column so the
  // calendar grid can fill the screen (and rows can shrink to 1fr).
  host: { class: 'flex flex-col flex-1 min-h-0 min-w-0' },
  template: `
    <div class="page-body cal-body p-(--s-6) flex flex-col gap-(--s-4) flex-1 min-h-0 min-w-0">
      <klar-hero
        eyebrow="Cashflow"
        [title]="monthLabel()"
        sub="Buchungen pro Tag · Klick auf einen Tag öffnet die Detailansicht."
      >
        <div heroActions class="flex items-center gap-2">
          <button
            class="btn ghost icon-only"
            type="button"
            (click)="prevMonth()"
            aria-label="Vorheriger Monat"
          >
            <klar-icon name="chevron-left" [size]="14" />
          </button>
          <klar-month-select
            [value]="txStore.currentMonth()"
            (valueChange)="onMonthPicked($event)"
          />
          <button
            class="btn ghost icon-only"
            type="button"
            (click)="nextMonth()"
            aria-label="Nächster Monat"
          >
            <klar-icon name="chevron-right" [size]="14" />
          </button>
        </div>
      </klar-hero>

      <!-- Mobile-only month nav (hero is desktop-only per app rule) -->
      <div class="md:hidden flex items-center gap-2">
        <button
          class="btn ghost icon-only"
          type="button"
          (click)="prevMonth()"
          aria-label="Vorheriger Monat"
        >
          <klar-icon name="chevron-left" [size]="14" />
        </button>
        <klar-month-select
          [value]="txStore.currentMonth()"
          (valueChange)="onMonthPicked($event)"
        />
        <button
          class="btn ghost icon-only"
          type="button"
          (click)="nextMonth()"
          aria-label="Nächster Monat"
        >
          <klar-icon name="chevron-right" [size]="14" />
        </button>
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <klar-tile
          label="Einnahmen"
          tone="success"
          [value]="formatStrip(totalIncomeCents(), true)"
        />
        <klar-tile
          label="Ausgaben"
          tone="danger"
          [value]="formatStrip(totalExpenseCents(), false)"
        />
        <klar-tile
          label="Saldo"
          [tone]="totalBalanceCents() >= 0 ? 'success' : 'danger'"
          [value]="formatStrip(totalBalanceCents(), totalBalanceCents() >= 0)"
          [valueClass]="totalBalanceCents() >= 0 ? 'text-(--success)' : 'text-(--danger)'"
        />
        <klar-tile
          label="Buchungen"
          [value]="totalCount() + ''"
        />
      </div>

      <!-- Calendar grid: fills the rest of the viewport, rows split evenly -->
      <div class="cal-grid-wrap flex-1 min-h-0">
        <div class="cal-week-head">
          @for (d of weekdays; track d) {
            <div>{{ d }}</div>
          }
        </div>
        <div
          class="cal-grid"
          [style.grid-template-rows]="'repeat(' + weekRows() + ', minmax(0, 1fr))'"
          [style.grid-auto-rows]="'minmax(0, 1fr)'"
        >
          @for (cell of cells(); track $index) {
            @if (cell.pad) {
              <div class="cal-cell pad"></div>
            } @else {
              <button
                type="button"
                class="cal-cell"
                [class.today]="cell.isToday"
                [class.weekend]="cell.isWeekend"
                [class.selected]="selectedIso() === cell.iso"
                [class.empty]="cell.txCount === 0"
                [attr.aria-label]="'Tag ' + cell.day"
                [attr.aria-pressed]="selectedIso() === cell.iso"
                (click)="selectDay(cell)"
              >
                <div class="cal-cell-head">
                  <span class="cal-day mono">{{ pad2(cell.day) }}</span>
                  @if (cell.txCount > 0) {
                    <span class="cal-count">{{ cell.txCount }}</span>
                  }
                </div>
                <div class="cal-cell-body">
                  @for (b of cell.pills; track b.id) {
                    <div
                      class="cal-pill"
                      [class.income]="b.amountCents > 0"
                      [style.--pill-tone]="categoryColor(b.categoryId)"
                      [title]="b.description"
                    >
                      <span class="cal-pill-dot" aria-hidden="true"></span>
                      <span class="cal-pill-text">{{ b.description || '—' }}</span>
                      <span class="cal-pill-amt mono">{{ pillAmount(b.amountCents) }}</span>
                    </div>
                  }
                  @if (cell.extraCount > 0) {
                    <div class="cal-more">+ {{ cell.extraCount }} weitere</div>
                  }
                </div>
                @if (cell.txCount > 0 && cell.totalCents !== 0) {
                  <div
                    class="cal-cell-sum mono"
                    [class.pos]="cell.totalCents >= 0"
                    [class.neg]="cell.totalCents < 0"
                  >
                    {{ cellSum(cell.totalCents) }}
                  </div>
                }
              </button>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class KalenderComponent implements OnInit {
  protected readonly txStore = inject(TransactionsStore);
  protected readonly catStore = inject(CategoriesStore);
  private readonly pageHeader = inject(PageHeaderService);
  private readonly dialogSvc = inject(KlarDialogService);

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
    // Monday-first offset (Mon=0..Sun=6)
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
      if (!inMonth) {
        cells.push({
          iso: '', day: 0, pad: true, isToday: false, isWeekend: false,
          totalCents: 0, pills: [], extraCount: 0, txCount: 0,
        });
        continue;
      }
      const date = new Date(year, month - 1, dayNum);
      const iso = this.toIso(date);
      const transactions = byDate.get(iso) ?? [];
      const totalCents = transactions.reduce((sum, t) => sum + t.amountCents, 0);
      const isWeekend = (i % 7) >= 5;
      cells.push({
        iso,
        day: dayNum,
        pad: false,
        isToday: iso === todayIso,
        isWeekend,
        totalCents,
        pills: transactions.slice(0, 3),
        extraCount: Math.max(0, transactions.length - 3),
        txCount: transactions.length,
      });
    }
    return cells;
  });

  /** Number of week rows (5 or 6) — drives grid-template-rows. */
  protected readonly weekRows = computed(() =>
    Math.max(1, Math.ceil(this.cells().length / 7)),
  );

  protected readonly totalIncomeCents = computed(() =>
    (this.txStore.items() ?? []).filter(t => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0),
  );
  protected readonly totalExpenseCents = computed(() =>
    (this.txStore.items() ?? []).filter(t => t.amountCents < 0).reduce((s, t) => s + t.amountCents, 0),
  );
  protected readonly totalBalanceCents = computed(
    () => this.totalIncomeCents() + this.totalExpenseCents(),
  );
  protected readonly totalCount = computed(
    () => (this.txStore.items() ?? []).length,
  );

  constructor() {
    // Keep page-header title in sync with the active month.
    effect(() => {
      this.pageHeader.title.set(this.monthLabel());
    });
  }

  ngOnInit(): void {
    this.pageHeader.set({
      title: this.monthLabel(),
      subtitle: 'Cashflow · Kalender',
      showUserSwitch: true,
      showExport: true,
      onExport: () => {
        // PDF export stub — wired once the export pipeline lands.
      },
    });
  }

  protected selectDay(cell: DayCell): void {
    if (cell.pad) return;
    this.selectedIso.set(cell.iso);
    const items = this.txStore.items() ?? [];
    const bookings = items.filter(t => t.date === cell.iso);
    this.dialogSvc.open({
      title: this.formatDayTitle(cell.iso),
      component: KalenderDayDialogComponent,
      inputs: { iso: cell.iso, bookings },
      width: 'md',
    });
  }

  protected prevMonth(): void {
    this.shiftMonth(-1);
  }

  protected nextMonth(): void {
    this.shiftMonth(1);
  }

  protected onMonthPicked(ym: string): void {
    if (!ym || ym === this.txStore.currentMonth()) return;
    this.txStore.currentMonth.set(ym);
    this.selectedIso.set(null);
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

  protected pad2(n: number): string {
    return String(n).padStart(2, '0');
  }

  /** Pill amount: integer for < 1000; "1.5k" for >= 1000. Sign prefix from amount. */
  protected pillAmount(cents: number): string {
    const euros = Math.abs(cents) / 100;
    const sign = cents < 0 ? '−' : '+';
    if (euros >= 1000) {
      return `${sign}${(Math.round(euros / 100) / 10).toString()}k`;
    }
    return `${sign}${Math.round(euros)}`;
  }

  /** Cell-bottom-right sum: signed integer-euros, no currency. */
  protected cellSum(cents: number): string {
    const euros = Math.abs(cents) / 100;
    const sign = cents >= 0 ? '+' : '−';
    if (euros >= 1000) {
      return `${sign}${(Math.round(euros / 100) / 10).toString()}k`;
    }
    return `${sign}${Math.round(euros)}`;
  }

  /** Strip values: € integer with sign for income/balance, plain for count. */
  protected formatStrip(cents: number, signed: boolean): string {
    const euros = cents / 100;
    const fmt = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    });
    const value = fmt.format(Math.abs(euros));
    if (cents === 0) return value;
    if (signed && cents > 0) return `+${value}`;
    return `−${value}`;
  }

  private formatDayTitle(iso: string): string {
    const [, m, d] = iso.split('-').map(Number);
    return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.`;
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
}
