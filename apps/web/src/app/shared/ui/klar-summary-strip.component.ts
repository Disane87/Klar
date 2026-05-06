import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { KlarMoneyPipe } from '../pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../pipes/klar-money-class.pipe';

@Component({
  selector: 'klar-summary-strip',
  standalone: true,
  imports: [NgClass, KlarMoneyPipe, KlarMoneyClassPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: { class: 'block' },
  template: `
    <div class="grid bg-(--surface) border-b-2 border-(--border) shrink-0"
         style="grid-template-columns: 1fr 1px 1fr 1px 1fr;">
      <div class="flex items-center gap-3 px-6 py-4 max-md:px-4 max-md:py-3 max-md:gap-2">
        <iconify-icon icon="lucide:wallet" width="24" height="24" class="text-(--color-income) shrink-0"></iconify-icon>
        <div class="flex flex-col gap-0.5 min-w-0">
          <span class="text-[10px] uppercase tracking-[0.12em] font-medium text-(--text-muted)">{{ incomeLabel() }}</span>
          <span class="font-mono tabular-nums font-bold text-(--color-income) leading-tight"
                style="font-size: var(--num-lg);">
            {{ incomeCents() | klarMoney }}
          </span>
        </div>
      </div>
      <div class="bg-(--border)"></div>
      <div class="flex items-center gap-3 px-6 py-4 max-md:px-4 max-md:py-3 max-md:gap-2">
        <iconify-icon icon="lucide:credit-card" width="24" height="24" class="text-(--color-expense) shrink-0"></iconify-icon>
        <div class="flex flex-col gap-0.5 min-w-0">
          <span class="text-[10px] uppercase tracking-[0.12em] font-medium text-(--text-muted)">{{ expenseLabel() }}</span>
          <span class="font-mono tabular-nums font-bold text-(--color-expense) leading-tight"
                style="font-size: var(--num-lg);">
            {{ expenseCents() | klarMoney }}
          </span>
        </div>
      </div>
      <div class="bg-(--border)"></div>
      <div class="flex items-center gap-3 px-6 py-4 max-md:px-4 max-md:py-3 max-md:gap-2">
        <iconify-icon icon="lucide:scale" width="24" height="24"
                      [ngClass]="balanceCents() | klarMoneyClass" class="shrink-0"></iconify-icon>
        <div class="flex flex-col gap-0.5 min-w-0">
          <span class="text-[10px] uppercase tracking-[0.12em] font-medium text-(--text-muted)">{{ balanceLabel() }}</span>
          <span class="font-mono tabular-nums font-bold leading-tight"
                style="font-size: var(--num-lg);"
                [ngClass]="balanceCents() | klarMoneyClass">
            {{ balanceCents() | klarMoney }}
          </span>
        </div>
      </div>
    </div>
  `,
})
export class KlarSummaryStripComponent {
  readonly incomeCents = input.required<number>();
  readonly expenseCents = input.required<number>();
  readonly balanceCents = input.required<number>();
  readonly incomeLabel = input('EINNAHMEN');
  readonly expenseLabel = input('AUSGABEN');
  readonly balanceLabel = input('BILANZ');
}
