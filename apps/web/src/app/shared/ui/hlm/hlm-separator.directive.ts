import { Directive, computed, input } from '@angular/core';
import { BrnSeparator } from '@spartan-ng/brain/separator';
import { hlm } from './hlm-utils';

@Directive({
  selector: '[hlmSeparator]',
  standalone: true,
  hostDirectives: [{ directive: BrnSeparator, inputs: ['orientation: orientation', 'decorative'] }],
  host: { '[class]': '_cls()' },
})
export class HlmSeparatorDirective {
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
  readonly userClass = input('', { alias: 'class' });
  readonly _cls = computed(() =>
    hlm(
      'shrink-0 bg-border',
      this.orientation() === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      this.userClass(),
    ),
  );
}
