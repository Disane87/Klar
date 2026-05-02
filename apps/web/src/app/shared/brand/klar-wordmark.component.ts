import { Component, input, computed } from '@angular/core';
import { KlarLogoMarkComponent } from './klar-logo-mark.component';

@Component({
  selector: 'klar-wordmark',
  standalone: true,
  host: { class: 'inline-flex items-center' },
  imports: [KlarLogoMarkComponent],
  templateUrl: './klar-wordmark.component.html',
  styleUrl: './klar-wordmark.component.css',
})
export class KlarWordmarkComponent {
  size  = input(36);
  color = input('currentColor');
  mark  = input<'ledger' | 'diamond'>('ledger');

  gap      = computed(() => this.size() * 0.18);
  fontSize = computed(() => this.size() * 0.78);
}
