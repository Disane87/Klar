import { Component, input, output } from '@angular/core';
import { KlarIconComponent } from '../icons/klar-icon.component';

export type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'subtle' | 'danger';
export type ButtonSize    = 'sm' | 'md' | 'lg';

@Component({
  selector: 'klar-button',
  standalone: true,
  imports: [KlarIconComponent],
  templateUrl: './klar-button.component.html',
  styleUrl: './klar-button.component.css',
})
export class KlarButtonComponent {
  variant   = input<ButtonVariant>('primary');
  size      = input<ButtonSize>('md');
  label     = input<string>();
  iconName  = input<string>();
  loading   = input(false);
  disabled  = input(false);
  type      = input<'button' | 'submit' | 'reset'>('button');
  fullWidth = input(false);

  clicked = output<void>();

  hostClass = () =>
    `size-${this.size()} variant-${this.variant()}${this.fullWidth() ? ' full-width' : ''}`;

  iconSize = () => (this.size() === 'sm' ? 12 : this.size() === 'lg' ? 16 : 14);
}
