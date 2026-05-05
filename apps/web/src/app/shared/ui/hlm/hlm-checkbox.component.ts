import { Component, ElementRef, computed, effect, input, model, viewChild } from '@angular/core';
import { hlm } from './hlm-utils';

@Component({
  selector: 'hlm-checkbox',
  standalone: true,
  template: `
    <input
      #input
      type="checkbox"
      [class]="_cls()"
      [checked]="checked()"
      [disabled]="disabled()"
      (change)="onChange($event)"
    />
  `,
  host: { class: 'inline-flex items-center' },
})
export class HlmCheckboxComponent {
  checked       = model(false);
  indeterminate = input(false);
  disabled      = input(false);
  userClass     = input('', { alias: 'class' });

  private inputEl = viewChild<ElementRef<HTMLInputElement>>('input');

  constructor() {
    effect(() => {
      const el = this.inputEl()?.nativeElement;
      if (el) el.indeterminate = this.indeterminate();
    });
  }

  onChange(ev: Event): void {
    this.checked.set((ev.target as HTMLInputElement).checked);
  }

  _cls = computed(() => hlm(
    'h-4 w-4 shrink-0 rounded-sm border border-primary accent-primary cursor-pointer',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    this.userClass()
  ));
}
