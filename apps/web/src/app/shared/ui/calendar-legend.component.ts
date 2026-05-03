import { Component } from '@angular/core';
import { KlarLegendItemComponent } from './legend-item.component';

@Component({
  selector: 'klar-calendar-legend',
  standalone: true,
  imports: [KlarLegendItemComponent],
  template: `
    <div class="flex items-center gap-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
      <klar-legend-item label="EINNAHME" color="var(--color-income)" />
      <klar-legend-item label="AUSGABE" color="var(--color-expense)" />
      <klar-legend-item label="FIXKOSTEN" color="var(--color-surplus)" />
    </div>
  `,
})
export class CalendarLegendComponent {}