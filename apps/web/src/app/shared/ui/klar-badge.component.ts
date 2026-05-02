import { Component, input } from '@angular/core';
import { HlmBadgeDirective, type BadgeVariant } from './hlm/hlm-badge.directive';

/** @deprecated Use HlmBadgeDirective ([hlmBadge]) directly */
export type BadgeTone = BadgeVariant;

@Component({
  selector: 'klar-badge',
  standalone: true,
  imports: [HlmBadgeDirective],
  template: `<span hlmBadge [variant]="tone()" [dim]="dim()"><ng-content /></span>`,
  styles: [`:host { display: contents; }`],
})
export class KlarBadgeComponent {
  tone = input<BadgeTone>('zinc');
  dim  = input(false);
}
