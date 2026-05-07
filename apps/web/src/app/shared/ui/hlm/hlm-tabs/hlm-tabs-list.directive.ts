import { Directive, computed, input } from '@angular/core';
import { BrnTabsList } from '@spartan-ng/brain/tabs';
import { hlm } from '../hlm-utils';

@Directive({
  selector: '[hlmTabsList]',
  standalone: true,
  hostDirectives: [BrnTabsList],
  host: {
    role: 'tablist',
    '[class]': '_cls()',
  },
})
export class HlmTabsListDirective {
  readonly userClass = input('', { alias: 'class' });
  readonly _cls = computed(() =>
    hlm(
      'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
      this.userClass(),
    ),
  );
}
