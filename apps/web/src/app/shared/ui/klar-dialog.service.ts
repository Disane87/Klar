// apps/web/src/app/shared/ui/klar-dialog.service.ts
import { Injectable, Type, inject, signal } from '@angular/core';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { KlarDialogComponent } from './klar-dialog.component';

export interface DialogConfig {
  title: string;
  component: Type<unknown>;
  inputs?: Record<string, unknown>;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  /** Makes the dialog fill most of the viewport height */
  height?: 'auto' | 'tall';
  /** If true, clicking the backdrop does not close the dialog */
  disableBackdropClose?: boolean;
}

const WIDTH_MAP = { sm: '400px', md: '520px', lg: '680px', xl: '980px' } as const;

@Injectable({ providedIn: 'root' })
export class KlarDialogService {
  private cdk = inject(Dialog);
  private ref: DialogRef<unknown, KlarDialogComponent> | null = null;

  readonly active = signal<boolean>(false);

  open(config: DialogConfig): void {
    this.close();
    const isTall = config.height === 'tall';
    this.ref = this.cdk.open(KlarDialogComponent, {
      data:          { width: 'md', height: 'auto', ...config },
      maxWidth:      WIDTH_MAP[config.width ?? 'md'],
      width:         '100%',
      height:        isTall ? '88dvh' : undefined,
      maxHeight:     isTall ? '88dvh' : undefined,
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
