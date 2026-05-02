import { Component, input } from '@angular/core';
import { KlarIconComponent } from '../icons/klar-icon.component';

@Component({
  selector: 'klar-month-chip',
  standalone: true,
  imports: [KlarIconComponent],
  host: { class: 'inline-flex' },
  template: `
    <span class="inline-flex h-7 items-center gap-1.5 rounded border border-border bg-surface px-2.5 text-xs tabular-nums font-medium">
      <klar-icon name="calendar" [size]="12" class="text-muted-foreground shrink-0" />
      <span class="font-mono">{{ label() }}</span>
    </span>
  `,
})
export class KlarMonthChipComponent {
  label = input.required<string>();
}
