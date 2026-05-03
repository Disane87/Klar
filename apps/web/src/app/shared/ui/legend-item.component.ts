import { Component, input } from '@angular/core';

@Component({
  selector: 'klar-legend-item',
  standalone: true,
  template: `
    <span class="flex items-center gap-1.5 leading-none">
      <span class="w-2 h-2 rounded-full" [style.background]="color()"></span>
      <span>{{ label() }}</span>
    </span>
  `,
})
export class KlarLegendItemComponent {
  label = input.required<string>();
  color = input.required<string>();
}