import { Component, input, output } from '@angular/core';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { KlarButtonComponent } from './klar-button.component';

@Component({
  selector: 'klar-error-bar',
  standalone: true,
  imports: [KlarIconComponent, KlarButtonComponent],
  template: `
    <div class="flex items-center gap-2 rounded border border-destructive/30 bg-destructive/5
                px-4 py-2.5 text-sm text-destructive">
      <klar-icon name="alert-circle" [size]="14" />
      <span class="flex-1">{{ message() }}</span>
      <klar-button tone="danger" size="sm" (click)="retry.emit()">
        Erneut versuchen
      </klar-button>
    </div>
  `,
})
export class KlarErrorBarComponent {
  message = input('Fehler beim Laden der Daten.');
  retry   = output<void>();
}
