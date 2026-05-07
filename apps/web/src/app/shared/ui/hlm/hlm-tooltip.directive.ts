import { Directive, input } from '@angular/core';
import { BrnTooltip } from '@spartan-ng/brain/tooltip';

/**
 * Tooltip wrapper. Apply on any focusable host. Pass text via [hlmTooltip].
 *
 *   <button hlmBtn hlmTooltip="Kopieren" position="top">…</button>
 */
@Directive({
  selector: '[hlmTooltip]',
  standalone: true,
  hostDirectives: [
    {
      directive: BrnTooltip,
      inputs: ['brnTooltip: hlmTooltip', 'position', 'showDelay', 'hideDelay', 'tooltipDisabled'],
      outputs: ['show', 'hide'],
    },
  ],
})
export class HlmTooltipDirective {
  readonly userClass = input('', { alias: 'class' });
}
