import { Component, input } from '@angular/core';

@Component({
  selector: 'klar-skeleton',
  standalone: true,
  templateUrl: './klar-skeleton.component.html',
  styleUrl: './klar-skeleton.component.css',
  host: {
    '[style.width]':  'width()',
    '[style.height]': 'height()',
  },
})
export class KlarSkeletonComponent {
  width  = input('100%');
  height = input('12px');
}
