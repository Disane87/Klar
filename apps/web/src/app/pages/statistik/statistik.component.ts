import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { OverviewStore } from '../../core/overview/overview.store';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { KlarTileComponent } from '../../shared/ui/klar-tile.component';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import {
  KlarChartCashflowBarsComponent,
} from '../../shared/charts/klar-chart-cashflow-bars.component';
import {
  KlarChartCumulativeComponent,
} from '../../shared/charts/klar-chart-cumulative.component';
import {
  KlarChartDonutComponent,
  type DonutSegment,
} from '../../shared/charts/klar-chart-donut.component';
import {
  KlarChartWeekdayHeatmapComponent,
} from '../../shared/charts/klar-chart-weekday-heatmap.component';
import { KlarHeroComponent } from '../../shared/ui/klar-hero.component';
import { KlarMonthSelectComponent } from '../../shared/ui/klar-month-select.component';

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
  categoryColor: string;
  cents: number;
}

@Component({
  selector: 'klar-statistik-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    KlarTileComponent,
    KlarMoneyPipe,
    KlarIconComponent,
    KlarChartCashflowBarsComponent,
    KlarChartCumulativeComponent,
    KlarChartDonutComponent,
    KlarChartWeekdayHeatmapComponent,
    KlarHeroComponent,
    KlarMonthSelectComponent,
  ],
  // Allow the page to grow with content and scroll within the shell.
  host: { class: 'flex flex-col flex-1 min-h-0 min-w-0 overflow-y-auto' },
  template: `
    <div class="flex flex-col gap-(--s-6) p-(--s-6) pb-16">

      <klar-hero
        eyebrow="Statistik"
        [title]="monthLabel()"
        sub="Auswertung des Monats · Filter über Haushalt und Monat."
      >
        <div heroActions class="flex flex-wrap items-center gap-2">
          <button
            class="btn ghost icon-only"
            type="button"
            (click)="prevMonth()"
            aria-label="Vorheriger Monat"
          >
            <klar-icon name="chevron-left" [size]="14" />
          </button>
          <klar-month-select
            [value]="currentMonth()"
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
          <button class="btn ghost text-[11px]" type="button" (click)="goToday()">
            heute
          </button>
        </div>
      </klar-hero>

      <!-- Mobile-only controls (hero is desktop-only per app rule) -->
      <div class="md:hidden flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn ghost icon-only"
            aria-label="Vorheriger Monat"
            (click)="prevMonth()"
          >
            <klar-icon name="chevron-left" [size]="14" />
          </button>
          <klar-month-select
            [value]="currentMonth()"
            (valueChange)="onMonthPicked($event)"
          />
          <button
            type="button"
            class="btn ghost icon-only"
            aria-label="Nächster Monat"
            (click)="nextMonth()"
          >
            <klar-icon name="chevron-right" [size]="14" />
          </button>
          <button class="btn ghost text-[11px]" type="button" (click)="goToday()">
            heute
          </button>
        </div>
      </div>

      <!-- KPI strip -->
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <klar-tile
          label="Einnahmen / Monat"
          [value]="(incomeCents() | klarMoney) ?? '—'"
        />
        <klar-tile
          label="Ausgaben / Monat"
          [value]="(expenseCents() | klarMoney) ?? '—'"
        />
        <klar-tile
          label="Überschuss"
          [value]="(surplusCents() | klarMoney) ?? '—'"
          [tone]="surplusCents() > 0 ? 'success' : 'danger'"
          [valueClass]="surplusCents() > 0 ? 'text-(--success)' : 'text-(--danger)'"
        />
        <klar-tile
          label="Sparquote"
          [value]="savingsRateLabel()"
        />
      </section>

      <!-- Two column charts on desktop -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-(--s-4)">
        <!-- Cashflow bars -->
        <section class="rounded-lg border border-(--line) bg-(--bg-1) overflow-hidden">
          <header class="flex items-center justify-between px-5 py-3 border-b border-(--line-soft)">
            <span class="eyebrow">Tagesverlauf</span>
            <span class="text-[11px] text-(--fg-2)">Einnahmen / Ausgaben pro Tag</span>
          </header>
          <klar-chart-cashflow-bars [items]="txItems()" [month]="currentMonth()" />
        </section>

        <!-- Cumulative -->
        <section class="rounded-lg border border-(--line) bg-(--bg-1) overflow-hidden">
          <header class="flex items-center justify-between px-5 py-3 border-b border-(--line-soft)">
            <span class="eyebrow">Kumulativer Saldo</span>
            <span class="text-[11px] mono"
                  [class.text-(--success)]="finalBalanceCents() >= 0"
                  [class.text-(--danger)]="finalBalanceCents() < 0">
              {{ finalBalanceCents() | klarMoney }}
            </span>
          </header>
          <klar-chart-cumulative [items]="txItems()" [month]="currentMonth()" />
        </section>

        <!-- Category donut -->
        <section class="rounded-lg border border-(--line) bg-(--bg-1) overflow-hidden">
          <header class="flex items-center justify-between px-5 py-3 border-b border-(--line-soft)">
            <span class="eyebrow">Kategorien</span>
            <span class="text-[11px] text-(--fg-2) mono">
              {{ categoryRowsTotal() | klarMoney }}
            </span>
          </header>
          <klar-chart-donut [segments]="donutSegments()">
            <span centerTop class="text-[10px] uppercase tracking-widest text-(--fg-3)">Fixkosten</span>
            <span centerMain
                  class="text-[18px] mono leading-none"
                  style="font-family: var(--font-display);">
              {{ shortMoney(categoryRowsTotal()) }}
            </span>
            <span centerSub class="text-[10px] text-(--fg-2) mt-1">
              {{ categoryRows().length }} Kategorien
            </span>
          </klar-chart-donut>
        </section>

        <!-- Weekday heatmap -->
        <section class="rounded-lg border border-(--line) bg-(--bg-1) overflow-hidden">
          <header class="flex items-center justify-between px-5 py-3 border-b border-(--line-soft)">
            <span class="eyebrow">Wochentage</span>
            <span class="text-[11px] text-(--fg-2)">Wo geht das Geld hin?</span>
          </header>
          <klar-chart-weekday-heatmap [items]="txItems()" />
        </section>
      </div>

      <!-- Category mix list (kept for detail) -->
      <section class="rounded-lg border border-(--line) bg-(--bg-1) overflow-hidden">
        <header class="flex items-center justify-between px-5 py-3 border-b border-(--line-soft)">
          <span class="eyebrow">Kategorien · Detail</span>
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
              <li class="flex items-center justify-between px-5 py-2 border-b border-(--line-soft) last:border-b-0 gap-3">
                <span
                  class="inline-block w-2 h-2 rounded-full shrink-0"
                  [style.background]="row.categoryColor"
                  aria-hidden="true"
                ></span>
                <div class="flex flex-col min-w-0 flex-1">
                  <span class="text-[13px] text-(--fg) truncate">{{ row.description || '—' }}</span>
                  <span class="text-[11px] text-(--fg-2) truncate">{{ row.categoryName }}</span>
                </div>
                <span
                  class="mono text-[13px] shrink-0"
                  [style.color]="row.cents < 0 ? 'var(--danger)' : 'var(--success)'"
                >{{ row.cents | klarMoney }}</span>
              </li>
            }
          </ul>
        }
      </section>
    </div>
  `,
})
export class StatistikComponent implements OnInit {
  protected readonly overviewStore = inject(OverviewStore);
  protected readonly txStore = inject(TransactionsStore);
  protected readonly catStore = inject(CategoriesStore);
  private readonly pageHeader = inject(PageHeaderService);

  /** `null` = household-wide; otherwise userId. Filters the fixed-cost mix only. */
  protected readonly memberFilter = signal<string | null>(null);

  protected readonly currentMonth = computed(() => this.overviewStore.currentMonth());

  protected readonly monthLabel = computed(() => {
    const [y, m] = this.currentMonth().split('-').map(Number);
    if (!y || !m) return this.currentMonth();
    return new Date(y, m - 1, 1).toLocaleDateString('de-DE', {
      month: 'long',
      year: 'numeric',
    });
  });

  protected readonly txItems = computed(() => this.txStore.items() ?? []);

  protected readonly incomeCents = computed(
    () => this.overviewStore.cashflow()?.totalIncomeCents ?? 0,
  );
  protected readonly expenseCents = computed(
    () => this.overviewStore.cashflow()?.totalExpensesCents ?? 0,
  );
  protected readonly surplusCents = computed(
    () => this.overviewStore.cashflow()?.surplusCents ?? 0,
  );

  protected readonly finalBalanceCents = computed(() =>
    this.txItems().reduce((s, t) => s + t.amountCents, 0),
  );

  protected readonly savingsRateLabel = computed(() => {
    const inc = this.incomeCents();
    if (inc === 0) return '—';
    const pct = (this.surplusCents() / inc) * 100;
    return `${pct.toFixed(1)} %`;
  });

  /** Fixed-cost groups, optionally filtered by createdById. */
  private readonly filteredGroups = computed(() => {
    const groups = this.overviewStore.fixedCosts()?.groups ?? [];
    const userId = this.memberFilter();
    if (!userId) return groups;
    return groups
      .map(g => {
        const items = g.items.filter(i => i.createdById === userId);
        const totalCents = items.reduce((s, i) => s + i.monthlyEquivalentCents, 0);
        return { ...g, items, totalCents };
      })
      .filter(g => g.items.length > 0);
  });

  protected readonly categoryRows = computed<CategoryMixRow[]>(() => {
    const groups = this.filteredGroups();
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

  protected readonly donutSegments = computed<DonutSegment[]>(() =>
    this.categoryRows().map(r => ({
      id: r.id,
      label: r.name,
      value: r.cents,
      color: r.color,
    })),
  );

  protected readonly topMovers = computed<TopMoverRow[]>(() => {
    const items = this.txItems();
    return [...items]
      .sort((a, b) => Math.abs(b.amountCents) - Math.abs(a.amountCents))
      .slice(0, 5)
      .map(t => {
        const cat = this.catStore.byId(t.categoryId ?? '');
        return {
          id: t.id,
          description: t.description,
          categoryName: cat?.name ?? 'Unkategorisiert',
          categoryColor: cat?.color ?? 'var(--fg-3)',
          cents: t.amountCents,
        };
      });
  });

  protected readonly memberLabel = computed(() => {
    const id = this.memberFilter();
    if (!id) return 'Haushalt';
    return id.slice(0, 8);
  });

  constructor() {
    // Keep page-header subtitle in sync with active month so the top-bar
    // crumb mirrors the page-internal nav.
    effect(() => {
      this.pageHeader.subtitle.set(`Auswertung · ${this.monthLabel()}`);
    });
  }

  ngOnInit(): void {
    this.pageHeader.set({
      title:              'Statistik',
      subtitle:           `Auswertung · ${this.monthLabel()}`,
      showUserSwitch:     true,
      onUserSwitchChange: (id) => this.memberFilter.set(id === 'all' ? null : id),
    });
  }

  protected onMonthPicked(ym: string): void {
    this.applyMonth(ym);
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
    this.applyMonth(ym);
  }

  protected shortMoney(cents: number): string {
    const eur = Math.abs(cents) / 100;
    const sign = cents < 0 ? '−' : '';
    if (eur >= 1000) return `${sign}${(Math.round(eur / 100) / 10).toString()}k €`;
    return `${sign}${Math.round(eur)} €`;
  }

  private shiftMonth(delta: number): void {
    const [y, m] = this.currentMonth().split('-').map(Number);
    const next = new Date(y, m - 1 + delta, 1);
    const ym = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    this.applyMonth(ym);
  }

  private applyMonth(ym: string): void {
    this.overviewStore.setMonth(ym);
    this.txStore.setMonth(ym);
  }
}
