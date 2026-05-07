import { Component, computed, input, model } from '@angular/core';
import { BrnSwitch, BrnSwitchThumb } from '@spartan-ng/brain/switch';
import { hlm } from './hlm-utils';

@Component({
  selector: 'hlm-switch',
  standalone: true,
  imports: [BrnSwitch, BrnSwitchThumb],
  template: `
    <brn-switch
      [(checked)]="checked"
      [disabled]="disabled()"
      [aria-label]="ariaLabel()"
      [class]="_btnCls()"
    >
      <brn-switch-thumb [class]="_thumbCls()" />
    </brn-switch>
  `,
})
export class HlmSwitchComponent {
  readonly checked = model(false);
  readonly disabled = input(false);
  readonly ariaLabel = input<string | null>(null);
  readonly userClass = input('', { alias: 'class' });

  readonly _btnCls = computed(() =>
    hlm(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full',
      'border-2 border-transparent transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
      this.userClass(),
    ),
  );

  readonly _thumbCls = computed(() =>
    hlm(
      'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
      'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
    ),
  );
}
