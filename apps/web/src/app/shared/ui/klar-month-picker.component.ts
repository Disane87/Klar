import { Component, computed, input, output } from '@angular/core';
import { KlarIconComponent } from '../icons/klar-icon.component';

@Component({
  selector: 'klar-month-picker',
  standalone: true,
  imports: [KlarIconComponent],
  template: `
    <div class="flex items-center gap-3">
      <button type="button"
              class="flex size-11 items-center justify-center rounded
                     text-muted-foreground transition-colors
                     hover:bg-accent hover:text-foreground active:opacity-70
                     disabled:pointer-events-none disabled:opacity-40"
              aria-label="Vorheriger Monat"
              (click)="prev()">
        <klar-icon name="chevron-left" [size]="18" />
      </button>
      <span class="min-w-[160px] text-center text-sm font-medium">{{ label() }}</span>
      <button type="button"
              class="flex size-11 items-center justify-center rounded
                     text-muted-foreground transition-colors
                     hover:bg-accent hover:text-foreground active:opacity-70
                     disabled:pointer-events-none disabled:opacity-40"
              aria-label="Nächster Monat"
              (click)="next()">
        <klar-icon name="chevron-right" [size]="18" />
      </button>
    </div>
  `,
})
export class KlarMonthPickerComponent {
  month       = input.required<string>();
  monthChange = output<string>();

  label = computed(() => {
    const [year, m] = this.month().split('-');
    return new Date(Number(year), Number(m) - 1, 1)
      .toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  });

  prev(): void {
    const [year, m] = this.month().split('-').map(Number);
    const d = new Date(year, m - 2, 1);
    this.monthChange.emit(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  next(): void {
    const [year, m] = this.month().split('-').map(Number);
    const d = new Date(year, m, 1);
    this.monthChange.emit(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
}
