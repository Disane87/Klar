import { Directive, computed, input } from '@angular/core';
import { BrnToggleGroupItem } from '@spartan-ng/brain/toggle-group';
import { hlm } from './hlm-utils';

@Directive({
  selector: 'button[hlmToggleGroupItem]',
  standalone: true,
  hostDirectives: [{ directive: BrnToggleGroupItem, inputs: ['value', 'disabled'] }],
  host: { '[class]': '_cls()' },
})
export class HlmToggleGroupItemDirective {
  readonly userClass = input('', { alias: 'class' });

  readonly _cls = computed(() =>
    hlm(
      'inline-flex flex-1 items-center justify-center rounded-lg px-3 min-h-[44px] text-sm font-medium transition-all duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'disabled:pointer-events-none disabled:opacity-50',
      'text-muted-foreground',
      'data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm',
      this.userClass(),
    ),
  );
}
