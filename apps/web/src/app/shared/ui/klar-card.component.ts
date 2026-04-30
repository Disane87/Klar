import { Component, input } from '@angular/core';

@Component({
  selector: 'klar-card',
  standalone: true,
  templateUrl: './klar-card.component.html',
  styleUrl: './klar-card.component.css',
  host: {
    '[class]': 'padding()',
  },
})
export class KlarCardComponent {
  padding = input<'' | 'compact' | 'flush'>('');
}
