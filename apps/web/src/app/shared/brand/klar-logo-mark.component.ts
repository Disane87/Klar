import { Component, input } from '@angular/core';

@Component({
  selector: 'klar-logo-mark',
  standalone: true,
  host: { class: 'inline-flex items-center' },
  templateUrl: './klar-logo-mark.component.html',
  styleUrl: './klar-logo-mark.component.css',
})
export class KlarLogoMarkComponent {
  variant = input<'ledger' | 'diamond'>('ledger');
  size    = input(36);
  color   = input('currentColor');
}
