import { Component, input, output } from '@angular/core';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { HlmButtonDirective } from './hlm/hlm-button.directive';

@Component({
  selector: 'klar-error-bar',
  standalone: true,
  imports: [KlarIconComponent, HlmButtonDirective],
  template: `
    <div class="flex items-center gap-2 rounded border border-destructive/30 bg-destructive/5
                px-4 py-2.5 text-sm text-destructive">
      <klar-icon name="alert-circle" [size]="14" />
      <span class="flex-1">{{ message() }}</span>
      <button type="button" hlmBtn variant="destructive" size="sm" (click)="retry.emit()">
        Erneut versuchen
      </button>
    </div>
  `,
})
export class KlarErrorBarComponent {
  message = input('Fehler beim Laden der Daten.');
  retry   = output<void>();
}
