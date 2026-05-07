import { Directive, computed, input } from '@angular/core';
import { BrnTabs } from '@spartan-ng/brain/tabs';
import { hlm } from '../hlm-utils';

@Directive({
  selector: '[hlmTabs]',
  standalone: true,
  hostDirectives: [
    {
      directive: BrnTabs,
      inputs: ['orientation', 'brnTabs: hlmTabs', 'activationMode'],
      outputs: ['brnTabsChange: hlmTabsChange', 'tabActivated'],
    },
  ],
  host: { '[class]': '_cls()' },
})
export class HlmTabsDirective {
  readonly userClass = input('', { alias: 'class' });
  readonly _cls = computed(() => hlm('flex flex-col gap-2', this.userClass()));
}
