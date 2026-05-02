import { Component, inject, HostListener } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { KlarIconComponent } from '../icons/klar-icon.component';
import type { DialogConfig } from './klar-dialog.service';

@Component({
  selector: 'klar-dialog-panel',
  standalone: true,
  imports: [NgComponentOutlet, KlarIconComponent],
  templateUrl: './klar-dialog.component.html',
  styleUrl: './klar-dialog.component.css',
})
export class KlarDialogComponent {
  protected cfg = inject<DialogConfig>(DIALOG_DATA);
  private   ref = inject(DialogRef);

  @HostListener('document:keydown.escape')
  onEscape(): void { this.ref.close(); }

  close(): void { this.ref.close(); }
}
