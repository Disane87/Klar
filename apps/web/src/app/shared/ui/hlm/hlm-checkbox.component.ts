import { Component, computed, input, model } from '@angular/core';
import { hlm } from './hlm-utils';

@Component({
  selector: 'hlm-checkbox',
  standalone: true,
  template: `
    <input
      type="checkbox"
      [class]="_cls()"
      [checked]="checked()"
      [disabled]="disabled()"
      (change)="checked.set($any($event.target).checked)"
    />
  `,
  host: { class: 'inline-flex items-center' },
})
export class HlmCheckboxComponent {
  checked   = model(false);
  disabled  = input(false);
  userClass = input('', { alias: 'class' });

  _cls = computed(() => hlm(
    'h-4 w-4 shrink-0 rounded-sm border border-primary accent-primary cursor-pointer',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    this.userClass()
  ));
}
