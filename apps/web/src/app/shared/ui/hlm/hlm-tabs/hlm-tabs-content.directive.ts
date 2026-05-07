import { Directive, computed, input } from '@angular/core';
import { BrnTabsContent } from '@spartan-ng/brain/tabs';
import { hlm } from '../hlm-utils';

@Directive({
  selector: '[hlmTabsContent]',
  standalone: true,
  hostDirectives: [{ directive: BrnTabsContent, inputs: ['brnTabsContent: hlmTabsContent'] }],
  host: { '[class]': '_cls()' },
})
export class HlmTabsContentDirective {
  readonly userClass = input('', { alias: 'class' });
  readonly _cls = computed(() =>
    hlm(
      'mt-2 ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      this.userClass(),
    ),
  );
}
