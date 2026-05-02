import { Component, input } from '@angular/core';

@Component({
  selector: 'hlm-spinner',
  standalone: true,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24"
         class="animate-spin flex-shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5"
              fill="none" opacity="0.25"/>
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5"
            fill="none" stroke-linecap="round"/>
    </svg>
  `,
})
export class HlmSpinnerComponent {
  size = input(14);
}
