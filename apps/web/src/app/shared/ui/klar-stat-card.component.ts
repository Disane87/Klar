import { Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { KlarMoneyPipe } from '../pipes/klar-money.pipe';

export type StatCardTone = 'income' | 'expense' | 'auto' | 'neutral';

@Component({
  selector: 'klar-stat-card',
  standalone: true,
  imports: [NgClass, KlarMoneyPipe],
  template: `
    <div class="flex flex-col gap-1 rounded border border-border bg-card px-4 py-3">
      <span class="text-[10px] uppercase tracking-widest text-muted-foreground">
        {{ label() }}
      </span>
      <span class="font-mono tabular-nums text-xl font-semibold" [ngClass]="_valueClass()">
        {{ valueCents() | klarMoney }}
      </span>
      @if (sub()) {
        <span class="text-[11px] text-muted-foreground">{{ sub() }}</span>
      }
    </div>
  `,
})
export class KlarStatCardComponent {
  label      = input.required<string>();
  valueCents = input.required<number>();
  sub        = input('');
  tone       = input<StatCardTone>('auto');

  _valueClass = computed(() => {
    switch (this.tone()) {
      case 'income':  return 'text-success';
      case 'expense': return 'text-danger';
      case 'auto':    return this.valueCents() >= 0 ? 'text-success' : 'text-danger';
      default:        return 'text-foreground';
    }
  });
}
