import { Component, computed, input } from '@angular/core';
import { KlarSkeletonComponent } from './klar-skeleton.component';

@Component({
  selector: 'klar-skeleton-cards',
  standalone: true,
  imports: [KlarSkeletonComponent],
  template: `
    @for (_ of _cards(); track $index) {
      <div class="flex flex-col gap-2 rounded border border-border px-4 py-3">
        <klar-skeleton height="9px" width="80px" />
        <klar-skeleton height="28px" width="60%" />
        <klar-skeleton height="11px" width="100%" />
      </div>
    }
  `,
})
export class KlarSkeletonCardsComponent {
  count  = input(4);
  _cards = computed(() => Array(this.count()).fill(null));
}
