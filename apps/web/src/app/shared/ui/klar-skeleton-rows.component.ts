import { Component, computed, input } from '@angular/core';
import { KlarSkeletonComponent } from './klar-skeleton.component';

@Component({
  selector: 'klar-skeleton-rows',
  standalone: true,
  imports: [KlarSkeletonComponent],
  template: `
    @for (_ of _rows(); track $index) {
      <div class="flex items-center gap-3 px-4 py-2">
        <klar-skeleton height="11px" width="36px" />
        <klar-skeleton height="13px" width="55%" />
        <klar-skeleton height="13px" width="70px" class="ml-auto" />
      </div>
    }
  `,
})
export class KlarSkeletonRowsComponent {
  count = input(5);
  _rows = computed(() => Array(this.count()).fill(null));
}
