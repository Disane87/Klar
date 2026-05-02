import { Directive, computed, input } from '@angular/core';

/**
 * Applies to button[hlmBtn] — disables button and sets aria-busy while loading.
 * Usage: <button hlmBtn [klarLoadingBtn]="loading()">Speichern</button>
 */
@Directive({
  selector: 'button[hlmBtn][klarLoadingBtn]',
  standalone: true,
  host: {
    '[disabled]':        '_isLoading()',
    '[attr.aria-busy]':  '_isLoading() ? "true" : null',
  },
})
export class HlmLoadingBtnDirective {
  klarLoadingBtn = input(false);
  _isLoading = computed(() => this.klarLoadingBtn());
}
