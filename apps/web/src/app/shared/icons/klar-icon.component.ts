import { Component, input } from '@angular/core';

@Component({
  selector: 'klar-icon',
  standalone: true,
  host: { class: 'inline-flex items-center leading-none' },
  templateUrl: './klar-icon.component.html',
  styleUrl: './klar-icon.component.css',
})
export class KlarIconComponent {
  name   = input.required<string>();
  size   = input(20);
  stroke = input(1.75);
}
