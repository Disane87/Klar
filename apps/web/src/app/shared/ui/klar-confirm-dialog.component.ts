import { Component, computed, inject, input } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { KlarButtonComponent, type KlarButtonTone } from './klar-button.component';

export interface KlarConfirmDialogData {
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: KlarButtonTone;
  resolve: (ok: boolean) => void;
}

@Component({
  selector: 'klar-confirm-dialog',
  standalone: true,
  imports: [KlarButtonComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <p class="text-sm text-foreground">{{ data().message }}</p>
        @if (data().detail) {
          <p class="text-xs text-muted-foreground whitespace-pre-line">{{ data().detail }}</p>
        }
      </div>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <klar-button tone="ghost" size="sm" (click)="onCancel()">
          {{ cancelLabel() }}
        </klar-button>
        <klar-button [tone]="tone()" size="sm" (click)="onConfirm()">
          {{ confirmLabel() }}
        </klar-button>
      </div>
    </div>
  `,
})
export class KlarConfirmDialogComponent {
  readonly data = input.required<KlarConfirmDialogData>();
  private ref = inject(DialogRef, { optional: true });

  protected readonly confirmLabel = computed(() => this.data().confirmLabel ?? 'Bestätigen');
  protected readonly cancelLabel = computed(() => this.data().cancelLabel ?? 'Abbrechen');
  protected readonly tone = computed<KlarButtonTone>(() => this.data().tone ?? 'primary');

  onCancel(): void {
    this.data().resolve(false);
    this.ref?.close();
  }

  onConfirm(): void {
    this.data().resolve(true);
    this.ref?.close();
  }
}
