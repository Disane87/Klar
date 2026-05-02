import { Component, inject, HostListener } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { KlarDialogService } from './klar-dialog.service';
import { KlarIconComponent } from '../icons/klar-icon.component';

@Component({
  selector: 'klar-dialog',
  standalone: true,
  imports: [NgComponentOutlet, KlarIconComponent],
  templateUrl: './klar-dialog.component.html',
  styleUrl: './klar-dialog.component.css',
})
export class KlarDialogComponent {
  protected dialog = inject(KlarDialogService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialog.active()) this.dialog.close();
  }

  onBackdropClick(event: MouseEvent): void {
    if (this.dialog.active()?.disableBackdropClose) return;
    if ((event.target as HTMLElement).classList.contains('backdrop')) {
      this.dialog.close();
    }
  }
}
