import { Component, input } from '@angular/core';

@Component({
  selector: 'klar-section-header',
  standalone: true,
  template: `
    <div class="flex items-center justify-between py-2">
      <span class="text-[10px] uppercase tracking-widest text-muted-foreground">
        {{ title() }}
      </span>
      <ng-content />
    </div>
  `,
})
export class KlarSectionHeaderComponent {
  title = input.required<string>();
}
