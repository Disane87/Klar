// apps/web/src/app/shared/ui/klar-dialog.service.ts
import { Injectable, Type, inject, signal } from '@angular/core';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { KlarDialogComponent } from './klar-dialog.component';

export interface DialogConfig {
  title: string;
  component: Type<unknown>;
  inputs?: Record<string, unknown>;
  width?: 'sm' | 'md' | 'lg';
  /** If true, clicking the backdrop does not close the dialog */
  disableBackdropClose?: boolean;
}

const WIDTH_MAP = { sm: '400px', md: '520px', lg: '680px' } as const;

@Injectable({ providedIn: 'root' })
export class KlarDialogService {
  private cdk = inject(Dialog);
  private ref: DialogRef<unknown, KlarDialogComponent> | null = null;

  readonly active = signal<boolean>(false);

  open(config: DialogConfig): void {
    this.close();
    this.ref = this.cdk.open(KlarDialogComponent, {
      data:          { width: 'md', ...config },
      maxWidth:      WIDTH_MAP[config.width ?? 'md'],
      width:         '100%',
      hasBackdrop:   true,
      backdropClass: 'klar-dialog-backdrop',
      panelClass:    'klar-dialog-panel',
      disableClose:  config.disableBackdropClose ?? false,
    });
    this.active.set(true);
    this.ref.closed.subscribe({
      next: () => this.active.set(false),
    });
  }

  close(): void {
    this.ref?.close();
    this.ref = null;
    this.active.set(false);
  }
}
