import { Component, computed, input } from '@angular/core';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { hlm } from './hlm/hlm-utils';

@Component({
  selector: 'klar-icon-button',
  standalone: true,
  imports: [KlarIconComponent],
  template: `
    <button type="button" [class]="_cls()" [attr.aria-label]="label()">
      <klar-icon [name]="icon()" [size]="iconSize()" />
    </button>
  `,
})
export class KlarIconButtonComponent {
  icon     = input.required<string>();
  label    = input('');
  iconSize = input(16);
  danger   = input(false);

  _cls = computed(() => hlm(
    'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded',
    'text-muted-foreground transition-colors',
    'hover:bg-accent hover:text-foreground active:opacity-70',
    'disabled:pointer-events-none disabled:opacity-40',
    this.danger() && 'hover:bg-destructive/10 hover:text-destructive',
  ));
}
