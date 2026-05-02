import { Directive, computed, input } from '@angular/core';
import { hlm } from '../hlm-utils';

@Directive({
  selector: 'select[hlmSelect]',
  standalone: true,
  host: { '[class]': '_cls()' },
})
export class HlmSelectNativeDirective {
  userClass = input('', { alias: 'class' });

  _cls = computed(() => hlm(
    'flex h-9 w-full rounded border border-input bg-background px-3',
    'text-[1rem] text-foreground',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'transition-colors',
    'appearance-none cursor-pointer',
    this.userClass()
  ));
}
