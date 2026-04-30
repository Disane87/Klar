import { Component, input } from '@angular/core';

export type BadgeTone = 'zinc' | 'emerald' | 'rose' | 'sky' | 'amber' | 'indigo';

@Component({
  selector: 'klar-badge',
  standalone: true,
  templateUrl: './klar-badge.component.html',
  styleUrl: './klar-badge.component.css',
  host: {
    '[class]': '"tone-" + tone() + (dim() ? " dim" : "")',
  },
})
export class KlarBadgeComponent {
  tone = input<BadgeTone>('zinc');
  dim  = input(false);
}
