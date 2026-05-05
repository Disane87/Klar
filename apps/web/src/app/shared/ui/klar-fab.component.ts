import { Component, input } from '@angular/core';

@Component({
  selector: 'klar-fab',
  standalone: true,
  host: {
    class: 'fixed left-1/2 -translate-x-1/2 z-50 bottom-[calc(env(safe-area-inset-bottom)+1rem)] md:bottom-6 flex items-center gap-2 px-3 py-2 rounded-full bg-(--surface) border border-(--border) shadow-lg shadow-black/30 animate-in fade-in slide-in-from-bottom-4 duration-200',
  },
  template: `
    @if (label()) {
      <span class="text-[12px] font-medium text-(--text) px-2 tabular-nums">
        {{ label() }}
      </span>
    }
    <ng-content />
  `,
})
export class KlarFabComponent {
  label = input<string>();
}
