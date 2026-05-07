import { Injectable, inject } from '@angular/core';
import { KlarDialogService } from './klar-dialog.service';
import { KlarConfirmDialogComponent } from './klar-confirm-dialog.component';
import type { KlarButtonTone } from './klar-button.component';

export interface KlarConfirmOptions {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: KlarButtonTone;
}

@Injectable({ providedIn: 'root' })
export class KlarConfirmService {
  private dialog = inject(KlarDialogService);

  /**
   * Replacement for `window.confirm()`. Resolves to `true` if confirmed,
   * `false` if cancelled or backdrop-clicked.
   */
  ask(opts: KlarConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.dialog.open({
        title: opts.title,
        component: KlarConfirmDialogComponent,
        width: 'sm',
        inputs: {
          data: {
            message: opts.message,
            detail: opts.detail,
            confirmLabel: opts.confirmLabel,
            cancelLabel: opts.cancelLabel,
            tone: opts.tone ?? 'primary',
            resolve,
          },
        },
      });
    });
  }
}
