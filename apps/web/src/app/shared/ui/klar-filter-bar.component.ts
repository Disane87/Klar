import { Component } from '@angular/core';

@Component({
  selector: 'klar-filter-bar',
  standalone: true,
  host: { class: 'block' },
  template: `
    <div
      class="flex flex-wrap items-end gap-2 p-3 rounded border border-border bg-muted/20"
    >
      <ng-content />
    </div>
  `,
})
export class KlarFilterBarComponent {}
