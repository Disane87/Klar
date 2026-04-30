import { Component, inject } from '@angular/core';
import { KlarToastService, Toast } from './klar-toast.service';
import { KlarIconComponent } from '../icons/klar-icon.component';

@Component({
  selector: 'klar-toast-container',
  standalone: true,
  imports: [KlarIconComponent],
  templateUrl: './klar-toast.component.html',
  styleUrl: './klar-toast.component.css',
})
export class KlarToastContainerComponent {
  protected service = inject(KlarToastService);

  protected toneIcon(toast: Toast): string {
    return toast.tone === 'success' ? 'check' : toast.tone === 'error' ? 'x' : 'alert';
  }
}
