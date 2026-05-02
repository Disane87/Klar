// apps/web/src/app/shared/ui/klar-dialog.service.ts
import { Injectable, signal, Type } from '@angular/core';

export interface DialogConfig {
  title: string;
  component: Type<unknown>;
  inputs?: Record<string, unknown>;
  width?: 'sm' | 'md' | 'lg';
  /** If true, clicking the backdrop does not close the dialog */
  disableBackdropClose?: boolean;
}

@Injectable({ providedIn: 'root' })
export class KlarDialogService {
  readonly active = signal<DialogConfig | null>(null);

  open(config: DialogConfig): void {
    this.active.set({ width: 'md', ...config });
  }

  close(): void {
    this.active.set(null);
  }
}
