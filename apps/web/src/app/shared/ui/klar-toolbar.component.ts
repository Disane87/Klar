import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'klar-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex items-center justify-between px-5 py-3 max-md:px-4 max-md:py-2 gap-3">
      <span class="text-[11px] uppercase tracking-wider font-semibold text-(--text-muted) shrink-0">
        {{ label() }}
      </span>
      <div class="flex items-center gap-2 flex-wrap justify-end">
        <ng-content />
      </div>
    </div>
  `,
})
export class KlarToolbarComponent {
  readonly label = input('');
}
