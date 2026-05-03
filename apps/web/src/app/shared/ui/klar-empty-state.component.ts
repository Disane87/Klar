import { Component, input, output } from '@angular/core';
import { KlarIconComponent } from '../icons/klar-icon.component';

@Component({
  selector: 'klar-empty-state',
  standalone: true,
  imports: [KlarIconComponent],
  template: `
    <div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <klar-icon [name]="icon()" [size]="36" [stroke]="1.25"
                 class="text-muted-foreground/40" />
      <p class="text-sm text-muted-foreground">{{ message() }}</p>
      @if (ctaLabel()) {
        <button hlmBtn size="sm" variant="default" type="button" class="mt-2" (click)="ctaClick.emit()">
          <klar-icon name="plus" [size]="14" class="mr-1.5" />
          {{ ctaLabel() }}
        </button>
      }
    </div>
  `,
})
export class KlarEmptyStateComponent {
  message = input.required<string>();
  icon    = input('inbox');
  ctaLabel = input<string>();
  ctaClick = output<void>();
}
