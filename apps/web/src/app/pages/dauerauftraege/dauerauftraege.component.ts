import {
  ChangeDetectionStrategy,
  Component,
  inject,
  computed,
} from '@angular/core';
import { StandingOrdersStore } from '../../core/standing-orders/standing-orders.store';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarHeroComponent } from '../../shared/ui/klar-hero.component';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { StandingOrderDialogComponent } from './standing-order-dialog.component';
import type { StandingOrder } from '../../core/standing-orders/standing-orders.store';

// Standing orders rarely exceed 50 entries so a plain <ul> with divide-y
// suffices here. If usage grows beyond ~50 items, migrate to klar-virtual-list.

const fmt = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const FREQ_LABELS: Record<string, string> = {
  WEEKLY:      'Wöchentlich',
  MONTHLY:     'Monatlich',
  QUARTERLY:   'Quartalsweise',
  HALF_YEARLY: 'Halbjährlich',
  YEARLY:      'Jährlich',
  CUSTOM:      'Individuell',
  UNKNOWN:     'Unbekannt',
};

@Component({
  selector: 'app-dauerauftraege',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    KlarHeroComponent,
    KlarButtonComponent,
    KlarEmptyStateComponent,
    KlarIconComponent,
  ],
  template: `
    <div class="flex flex-col gap-(--s-6) p-(--s-6) pb-16 min-w-0">
      <klar-hero
        eyebrow="Daueraufträge"
        title="Wiederkehrende Bank-Aufträge"
        sub="Aus FinTS-Buchungen erkannt oder manuell angelegt."
      >
        <klar-icon heroEyebrowIcon name="repeat" [size]="11" />

        <div heroActions class="flex flex-wrap items-center gap-3">
          <label class="flex items-center gap-2 cursor-pointer select-none text-[13px] text-(--fg-2)">
            <input
              type="checkbox"
              class="accent-(--accent) w-4 h-4 cursor-pointer"
              [checked]="store.includeInactive()"
              (change)="store.includeInactive.set($any($event.target).checked)"
            />
            Inaktive zeigen
          </label>
          <klar-button tone="primary" size="sm" icon="plus" (click)="openCreate()">
            Manueller Eintrag
          </klar-button>
        </div>
      </klar-hero>

      @if (store.isLoading() && !store.items()) {
        <div class="rounded-lg border border-(--line) bg-(--bg-1) px-5 py-10 text-center text-(--fg-2) text-sm">
          Lade …
        </div>
      } @else if (store.isEmpty()) {
        <klar-empty-state
          icon="repeat"
          message="Noch keine Daueraufträge — sie erscheinen automatisch nach dem nächsten FinTS-Sync."
          ctaLabel="Manuell anlegen"
          (ctaClick)="openCreate()"
        />
      } @else {
        <ul class="rounded-lg border border-(--line) bg-(--bg-1) divide-y divide-(--line) overflow-hidden">
          @for (order of store.items(); track order.id) {
            <li
              class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-(--bg-2) dark:hover:bg-(--bg-2) transition-colors min-w-0"
              (click)="openEdit(order)"
              role="button"
              [attr.aria-label]="'Dauerauftrag bearbeiten: ' + (order.counterpartyName ?? 'Unbekannt')"
            >
              <!-- Left: name + badges -->
              <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="text-sm font-medium text-(--fg) truncate min-w-0">
                    {{ order.counterpartyName ?? 'Unbekannt' }}
                  </span>
                  <!-- Source badge -->
                  @if (order.source === 'FINTS_DERIVED') {
                    <span class="shrink-0 inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium tracking-wide bg-(--accent)/15 text-(--accent)">
                      Bank
                    </span>
                  } @else {
                    <span class="shrink-0 inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium tracking-wide bg-(--fg-3)/20 text-(--fg-2)">
                      Manuell
                    </span>
                  }
                  <!-- Inactive badge -->
                  @if (!order.isActive) {
                    <span class="shrink-0 inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium tracking-wide bg-(--color-expense)/15 text-(--color-expense)">
                      Inaktiv
                    </span>
                  }
                </div>
                <!-- Frequency + next date (shown on md+) -->
                <div class="hidden md:flex items-center gap-2 text-[11px] text-(--fg-2)">
                  <span>{{ freqLabel(order.frequency) }}</span>
                  @if (order.nextExpectedAt) {
                    <span>·</span>
                    <span>nächste: {{ formatDate(order.nextExpectedAt) }}</span>
                  }
                </div>
              </div>

              <!-- Right: amount -->
              <span
                class="shrink-0 text-sm font-medium font-mono tabular-nums"
                [class]="order.amountCents >= 0 ? 'text-success' : 'text-danger'"
              >
                {{ formatAmount(order.amountCents) }}
              </span>

              <klar-icon name="chevron-right" [size]="14" class="shrink-0 text-(--fg-3) hidden md:inline-flex" />
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class DauerauftraegeComponent {
  protected readonly store = inject(StandingOrdersStore);
  private readonly dialog = inject(KlarDialogService);

  protected readonly isEmpty = computed(() => (this.store.items()?.length ?? 0) === 0);

  openCreate(): void {
    this.dialog.open({
      title: 'Dauerauftrag anlegen',
      component: StandingOrderDialogComponent,
      inputs: { mode: 'create' },
      width: 'md',
    });
  }

  openEdit(order: StandingOrder): void {
    this.dialog.open({
      title: 'Dauerauftrag bearbeiten',
      component: StandingOrderDialogComponent,
      inputs: { mode: 'edit', item: order },
      width: 'md',
    });
  }

  protected freqLabel(freq: string): string {
    return FREQ_LABELS[freq] ?? freq;
  }

  protected formatAmount(cents: number): string {
    return fmt.format(cents / 100);
  }

  protected formatDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        .format(new Date(iso));
    } catch {
      return iso;
    }
  }
}
