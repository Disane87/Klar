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
    'flex w-full rounded border border-input bg-background px-3',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'transition-colors',
    'text-[1rem]',
    'h-9',
    this.userClass()
  ));
}
