import { Component, inject, input, output } from '@angular/core';
import { KlarButtonComponent } from './klar-button.component';
import { KlarDialogService } from './klar-dialog.service';

/**
 * Standard dialog footer: ghost cancel + primary confirm. Stacks on mobile,
 * row on >=sm. Default cancel closes the active KlarDialog.
 *
 *   <klar-dialog-footer
 *     confirmLabel="Speichern"
 *     [confirmDisabled]="!form.valid()"
 *     [confirmLoading]="saving()"
 *     (confirm)="save()" />
 */
@Component({
  selector: 'klar-dialog-footer',
  standalone: true,
  imports: [KlarButtonComponent],
  template: `
    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
      <div class="sm:flex-1 flex flex-col-reverse gap-2 sm:flex-row">
        <ng-content select="[start]" />
      </div>
      <klar-button tone="ghost" size="sm" (click)="onCancel()">
        {{ cancelLabel() }}
      </klar-button>
      @if (showConfirm()) {
        <klar-button
          [tone]="confirmTone()"
          size="sm"
          [disabled]="confirmDisabled()"
          [loading]="confirmLoading()"
          (click)="confirm.emit()"
        >
          {{ confirmLabel() }}
        </klar-button>
      }
    </div>
  `,
})
export class KlarDialogFooterComponent {
  readonly cancelLabel = input('Abbrechen');
  readonly confirmLabel = input('Speichern');
  readonly confirmTone = input<'primary' | 'danger' | 'secondary'>('primary');
  readonly confirmDisabled = input(false);
  readonly confirmLoading = input(false);
  readonly showConfirm = input(true);
  readonly autoCloseOnCancel = input(true);

  readonly cancel = output<void>();
  readonly confirm = output<void>();

  private dialog = inject(KlarDialogService);

  onCancel(): void {
    this.cancel.emit();
    if (this.autoCloseOnCancel()) this.dialog.close();
  }
}
