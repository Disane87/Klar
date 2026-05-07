import { Directive, computed, input } from '@angular/core';
import { BrnTabsTrigger } from '@spartan-ng/brain/tabs';
import { hlm } from '../hlm-utils';

@Directive({
  selector: 'button[hlmTabsTrigger]',
  standalone: true,
  hostDirectives: [
    { directive: BrnTabsTrigger, inputs: ['brnTabsTrigger: hlmTabsTrigger', 'disabled'] },
  ],
  host: {
    type: 'button',
    '[class]': '_cls()',
  },
})
export class HlmTabsTriggerDirective {
  readonly userClass = input('', { alias: 'class' });
  readonly _cls = computed(() =>
    hlm(
      'inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium',
      'ring-offset-background transition-all',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      this.userClass(),
    ),
  );
}
