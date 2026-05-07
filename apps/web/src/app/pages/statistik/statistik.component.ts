import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { OverviewStore } from '../../core/overview/overview.store';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { KlarMetricTileComponent } from '../../shared/ui/klar-metric-tile.component';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { PageHeaderService } from '../../core/page-header/page-header.service';

interface CategoryMixRow {
  id: string;
  name: string;
  color: string;
  cents: number;
  pct: number;
}

interface TopMoverRow {
  id: string;
  description: string;
  categoryName: string;
  cents: number;
}

@Component({
  selector: 'klar-statistik-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, KlarMetricTileComponent, KlarMoneyPipe],
  template: `
    <div class="flex flex-col gap-(--s-6) p-(--s-6) pb-16">
      <!-- KPI strip -->
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <klar-metric-tile
          label="Einnahmen / Monat"
          [value]="(incomeCents() | klarMoney) ?? '—'"
        />
        <klar-metric-tile
          label="Ausgaben / Monat"
          [value]="(expenseCents() | klarMoney) ?? '—'"
        />
        <klar-metric-tile
          label="Überschuss"
          [value]="(surplusCents() | klarMoney) ?? '—'"
          [accent]="surplusCents() > 0"
        />
        <klar-metric-tile
          label="Sparquote"
          [value]="savingsRateLabel()"
        />
      </section>

      <!-- Category mix -->
      <section class="rounded-lg border border-(--line) bg-(--bg-1) overflow-hidden">
        <header class="flex items-center justify-between px-5 py-3 border-b border-(--line-soft)">
          <span class="eyebrow">Kategorien</span>
          <span class="text-[11px] text-(--fg-2) mono">
            {{ categoryRowsTotal() | klarMoney }}
          </span>
        </header>
        @if (categoryRows().length === 0) {
          <div class="px-5 py-6 text-center text-[12px] text-(--fg-2)">
            Noch keine Kategoriedaten für diesen Monat.
          </div>
        } @else {
          <ul>
            @for (row of categoryRows(); track row.id) {
              <li
                class="cat-bar grid items-center gap-3 px-5 py-2 border-b border-(--line-soft) last:border-b-0"
                style="grid-template-columns: 1fr 80px 90px;"
                [style.--cat-color]="row.color"
              >
                <span class="text-[13px] text-(--fg) truncate">{{ row.name }}</span>
                <div class="relative h-1 rounded-full overflow-hidden bg-(--line-soft) shrink-0">
                  <span
                    class="absolute inset-y-0 left-0 rounded-full"
                    [style.width.%]="row.pct"
                    [style.background]="row.color"
                  ></span>
                </div>
                <span class="text-[12px] mono text-right text-(--fg)">
                  {{ row.cents | klarMoney }}
                </span>
              </li>
            }
          </ul>
        }
      </section>

      <!-- Top movers -->
      <section class="rounded-lg border border-(--line) bg-(--bg-1) overflow-hidden">
        <header class="flex items-center justify-between px-5 py-3 border-b border-(--line-soft)">
          <span class="eyebrow">Top-Bewegungen</span>
          <span class="text-[11px] text-(--fg-2)">Top 5 nach Betrag</span>
        </header>
        @if (topMovers().length === 0) {
          <div class="px-5 py-6 text-center text-[12px] text-(--fg-2)">
            Keine Buchungen in diesem Monat.
          </div>
        } @else {
          <ul>
            @for (row of topMovers(); track row.id) {
              <li class="flex items-center justify-between px-5 py-2 border-b border-(--line-soft) last:border-b-0">
                <div class="flex flex-col min-w-0">
                  <span class="text-[13px] text-(--fg) truncate">{{ row.description || '—' }}</span>
                  <span class="text-[11px] text-(--fg-2) truncate">{{ row.categoryName }}</span>
                </div>
                <span
                  class="mono text-[13px]"
                  [style.color]="row.cents < 0 ? 'var(--danger)' : 'var(--success)'"
                >{{ row.cents | klarMoney }}</span>
              </li>
            }
          </ul>
        }
      </section>

      <!-- Hint about multi-month trend -->
      <p class="text-[11px] text-(--fg-3) px-2">
        Mehrmonatsverlauf, Heatmap und Recurring-Spend folgen, sobald die Statistics-API verfügbar ist.
      </p>
    </div>
  `,
})
export class StatistikComponent implements OnInit {
  protected readonly overviewStore = inject(OverviewStore);
  protected readonly txStore = inject(TransactionsStore);
  protected readonly catStore = inject(CategoriesStore);
  private readonly pageHeader = inject(PageHeaderService);

  protected readonly incomeCents = computed(
    () => this.overviewStore.cashflow()?.totalIncomeCents ?? 0,
  );
  protected readonly expenseCents = computed(
    () => this.overviewStore.cashflow()?.totalExpensesCents ?? 0,
  );
  protected readonly surplusCents = computed(
    () => this.overviewStore.cashflow()?.surplusCents ?? 0,
  );

  protected readonly savingsRateLabel = computed(() => {
    const inc = this.incomeCents();
    if (inc === 0) return '—';
    const pct = (this.surplusCents() / inc) * 100;
    return `${pct.toFixed(1)} %`;
  });

  protected readonly categoryRows = computed<CategoryMixRow[]>(() => {
    const groups = this.overviewStore.fixedCosts()?.groups ?? [];
    if (groups.length === 0) return [];
    const total = groups.reduce((sum, g) => sum + Math.abs(g.totalCents), 0);
    if (total === 0) return [];
    return groups
      .map(g => ({
        id: g.categoryId,
        name: g.categoryName,
        color: g.categoryColor,
        cents: g.totalCents,
        pct: (Math.abs(g.totalCents) / total) * 100,
      }))
      .sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
  });

  protected readonly categoryRowsTotal = computed(() =>
    this.categoryRows().reduce((s, r) => s + r.cents, 0),
  );

  protected readonly topMovers = computed<TopMoverRow[]>(() => {
    const items = this.txStore.items() ?? [];
    return [...items]
      .sort((a, b) => Math.abs(b.amountCents) - Math.abs(a.amountCents))
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        description: t.description,
        categoryName: this.catStore.byId(t.categoryId ?? '')?.name ?? 'Unkategorisiert',
        cents: t.amountCents,
      }));
  });

  ngOnInit(): void {
    this.pageHeader.set({ title: 'Statistik', subtitle: 'Auswertung · aktueller Monat' });
  }
}
