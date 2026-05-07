import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CategoriesStore } from '../../../core/categories/categories.store';
import type { Transaction } from '../../../core/transactions/transactions.store';
import { KlarMoneyPipe } from '../../../shared/pipes/klar-money.pipe';
import { KlarIconComponent } from '../../../shared/icons/klar-icon.component';
import { KlarDialogService } from '../../../shared/ui/klar-dialog.service';

@Component({
  selector: 'klar-kalender-day-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, KlarMoneyPipe, KlarIconComponent],
  template: `
    <div class="cal-day-sheet">
      <div class="px-4 pb-3 -mt-2">
        <span class="setting-hint">
          {{ bookings().length }} {{ bookings().length === 1 ? 'Buchung' : 'Buchungen' }} ·
          Saldo
          <span
            class="mono"
            [style.color]="totalCents() < 0 ? 'var(--fg-2)' : 'var(--success)'"
          >
            {{ totalCents() | klarMoney }}
          </span>
        </span>
        <div class="text-[16px] font-medium leading-tight mt-1"
             style="font-family: var(--font-display); letter-spacing: -0.01em;">
          {{ iso() | date:'EEEE, dd. MMMM yyyy' }}
        </div>
      </div>

      <div class="cal-day-list">
        @if (bookings().length === 0) {
          <div class="px-4 py-8 text-center text-(--fg-2) text-[12px]">
            Keine Buchungen an diesem Tag.
          </div>
        } @else {
          @for (b of bookings(); track b.id) {
            <div class="cal-day-row" [style.--cat-tone]="categoryColor(b.categoryId)">
              <span class="cal-day-bar"></span>
              <div class="min-w-0">
                <div class="cal-day-name">
                  <span class="truncate">{{ b.description || '—' }}</span>
                  @if (b.recurringTransactionId) {
                    <span class="chip outline" style="height: 16px; font-size: 9px;">
                      wiederkehrend
                    </span>
                  }
                </div>
                <div class="cal-day-meta">
                  <span [style.color]="categoryColor(b.categoryId)">●</span>
                  <span>{{ categoryName(b.categoryId) || 'Unkategorisiert' }}</span>
                </div>
              </div>
              <span
                class="mono text-[13px]"
                [style.color]="b.amountCents < 0 ? 'var(--fg)' : 'var(--success)'"
              >
                {{ b.amountCents | klarMoney }}
              </span>
            </div>
          }
        }
      </div>

      <div class="flex items-center gap-2 px-4 py-3 border-t border-(--line-soft)">
        <span class="flex-1"></span>
        <button class="btn ghost" type="button" (click)="onCreate()">
          <klar-icon name="plus" [size]="13" />
          Buchung anlegen
        </button>
        <button class="btn primary" type="button" (click)="close()">Schließen</button>
      </div>
    </div>
  `,
})
export class KalenderDayDialogComponent {
  private readonly catStore = inject(CategoriesStore);
  private readonly dialog = inject(KlarDialogService);

  readonly iso = input.required<string>();
  readonly bookings = input.required<Transaction[]>();

  protected readonly totalCents = computed(() =>
    this.bookings().reduce((s, t) => s + t.amountCents, 0),
  );

  protected categoryColor(id: string | null): string {
    if (!id) return 'var(--accent)';
    return this.catStore.byId(id)?.color ?? 'var(--accent)';
  }

  protected categoryName(id: string | null): string | null {
    if (!id) return null;
    return this.catStore.byId(id)?.name ?? null;
  }

  protected close(): void {
    this.dialog.close();
  }

  protected onCreate(): void {
    // TODO(spec): wire up to transaction-create dialog with prefilled date
    this.dialog.close();
  }
}
