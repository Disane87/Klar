import { Directive, computed, input } from '@angular/core';
import { hlm } from './hlm-utils';

@Directive({
  selector: 'input[hlmInput], textarea[hlmInput]',
  standalone: true,
  host: { '[class]': '_cls()' },
})
export class HlmInputDirective {
  userClass = input('', { alias: 'class' });

  _cls = computed(() => hlm(
    'flex w-full rounded border border-(--border) bg-(--surface) px-3',
    'placeholder:text-(--text-muted)',
    'focus-visible:outline-none focus-visible:border-(--accent)/60 focus-visible:ring-1 focus-visible:ring-(--accent)/40',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'transition-colors',
    'text-base',
    'h-8',
    this.userClass()
  ));
}
