import { Directive, computed, input } from '@angular/core';
import { hlm } from './hlm-utils';

@Directive({
  selector: 'label[hlmLabel]',
  standalone: true,
  host: { '[class]': '_cls()' },
})
export class HlmLabelDirective {
  userClass = input('', { alias: 'class' });

  _cls = computed(() => hlm(
    'text-[9px] font-medium uppercase tracking-widest text-muted-foreground',
    this.userClass()
  ));
}
