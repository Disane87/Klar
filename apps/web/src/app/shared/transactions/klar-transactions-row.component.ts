import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CategoriesStore } from '../../core/categories/categories.store';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { BrandIconComponent } from '../ui/brand-icon.component';
import { KlarMoneyPipe } from '../pipes/klar-money.pipe';
import type { Transaction } from '../../core/transactions/transactions.store';

interface RowTypeChip {
  label: string;
  /** Tailwind classes for bg + text. */
  classes: string;
}

const FINTS_KIND_CHIP: Partial<Record<NonNullable<Transaction['transactionKind']>, RowTypeChip>> = {
  STANDING_ORDER: { label: 'Dauerauftrag',     classes: 'bg-(--accent)/15 text-(--accent)' },
  DIRECT_DEBIT:   { label: 'SEPA-Lastschrift', classes: 'bg-(--color-info)/15 text-(--color-info)' },
  TRANSFER:       { label: 'Überweisung',      classes: 'bg-(--fg-3)/20 text-(--fg-2)' },
  CARD:           { label: 'Karte',            classes: 'bg-(--fg-3)/20 text-(--fg-2)' },
  FEE:            { label: 'Gebühr',           classes: 'bg-(--color-expense)/15 text-(--color-expense)' },
};

@Component({
  selector: 'klar-transactions-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlarIconComponent, BrandIconComponent, KlarMoneyPipe],
  template: `
    <div
      role="button"
      tabindex="0"
      class="grid items-center gap-3 px-4 py-3 border-b border-(--line-soft) hover:bg-(--bg-2) transition-colors cursor-pointer min-h-[44px]"
      style="grid-template-columns: 60px auto 1fr auto;"
      [style.border-left]="'2px solid ' + categoryColor()"
      (click)="rowClick.emit(tx())"
      (keydown.enter)="rowClick.emit(tx())"
      (keydown.space)="$event.preventDefault(); rowClick.emit(tx())"
    >
      <span class="text-[11px] mono tabular-nums text-(--fg-2)">{{ dayLabel() }}</span>
      <!-- Brand-icon auto-detects from counterparty/description; falls back to the category icon + colour -->
      <app-brand-icon
        class="shrink-0"
        [name]="primaryLabel()"
        [size]="16"
        [fallbackIcon]="iconName()"
        [fallbackColor]="categoryColor()"
      />
      <div class="min-w-0">
        <div class="text-[13px] truncate text-(--fg) flex items-center gap-2">
          <span class="truncate">{{ primaryLabel() }}</span>
          @if (tx().recurringTransactionId) {
            <span class="chip outline" style="height:18px;font-size:10px;">
              <klar-icon name="wiederkehrend" [size]="10" /> wiederkehrend
            </span>
          }
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        @let chip = typeChip();
        @if (chip) {
          <span
            class="inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium tracking-wide"
            [class]="chip.classes"
          >
            {{ chip.label }}
          </span>
        }
        <span
          class="text-[13px] mono tabular-nums font-medium"
          [class.text-success]="tx().amountCents > 0"
          [class.text-danger]="tx().amountCents < 0"
        >
          {{ tx().amountCents > 0 ? '+ ' : '' }}{{ tx().amountCents | klarMoney }}
        </span>
      </div>
    </div>
  `,
})
export class KlarTransactionsRowComponent {
  readonly tx = input.required<Transaction>();
  readonly rowClick = output<Transaction>();

  private readonly categories = inject(CategoriesStore);

  readonly primaryLabel = computed(() =>
    this.tx().counterparty?.trim() || this.tx().description?.trim() || '—',
  );

  readonly dayLabel = computed(() => {
    const [, mm, dd] = this.tx().date.split('-');
    return `${dd}.${mm}.`;
  });

  readonly categoryColor = computed(() => {
    const t = this.tx();
    const cat = t.categoryId ? this.categories.byId(t.categoryId) : null;
    return cat?.color ?? (t.amountCents >= 0 ? 'var(--success)' : 'var(--fg-3)');
  });

  readonly iconName = computed(() => {
    const t = this.tx();
    if (t.icon) return t.icon;
    if (!t.categoryId) return t.amountCents > 0 ? 'trending' : 'receipt';
    return this.categories.byId(t.categoryId)?.icon ?? 'receipt';
  });

  readonly typeChip = computed<RowTypeChip | null>(() => {
    const t = this.tx();
    if (t.source === 'manual') return { label: 'Manuell', classes: 'bg-(--fg-3)/20 text-(--fg-2)' };
    if (t.source === 'csv')    return { label: 'CSV',     classes: 'bg-(--fg-3)/20 text-(--fg-2)' };
    if (t.source === 'fints') {
      if (t.transactionKind && FINTS_KIND_CHIP[t.transactionKind]) {
        return FINTS_KIND_CHIP[t.transactionKind] ?? null;
      }
      return { label: 'FinTS', classes: 'bg-(--fg-3)/20 text-(--fg-2)' };
    }
    return null;
  });
}
