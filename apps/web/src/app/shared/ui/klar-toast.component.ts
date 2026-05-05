import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { KlarToastService, Toast } from './klar-toast.service';
import { KlarIconComponent } from '../icons/klar-icon.component';

@Component({
  selector: 'klar-toast-container',
  standalone: true,
  imports: [KlarIconComponent, NgClass],
  templateUrl: './klar-toast.component.html',
})
export class KlarToastContainerComponent {
  protected service = inject(KlarToastService);

  protected toneIcon(toast: Toast): string {
    return toast.tone === 'success' ? 'check' : toast.tone === 'error' ? 'x' : 'alert';
  }
}
