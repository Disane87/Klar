import { Directive, computed, input } from '@angular/core';
import { BrnToggleGroup } from '@spartan-ng/brain/toggle-group';
import { hlm } from './hlm-utils';

@Directive({
  selector: '[hlmToggleGroup]',
  standalone: true,
  hostDirectives: [{ directive: BrnToggleGroup, inputs: ['type', 'value', 'nullable', 'disabled'], outputs: ['valueChange', 'change'] }],
  host: { '[class]': '_cls()' },
})
export class HlmToggleGroupDirective {
  readonly userClass = input('', { alias: 'class' });
  readonly _cls = computed(() =>
    hlm('inline-flex items-center gap-1 rounded-xl bg-muted/50 p-1', this.userClass()),
  );
}
