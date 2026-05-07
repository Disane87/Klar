import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmInputDirective } from '../../../shared/ui/hlm/hlm-input.directive';
import { KlarDialogFooterComponent } from '../../../shared/ui/klar-dialog-footer.component';
import { KlarDialogService } from '../../../shared/ui/klar-dialog.service';

/**
 * Demo: Verwerfen-Schutz — when the form has unsaved edits and the user
 * cancels, prompt for confirmation before closing the outer dialog.
 */
@Component({
  selector: 'klar-sample-discard-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, HlmInputDirective, KlarDialogFooterComponent],
  template: `
    @if (!confirmingDiscard()) {
      <div class="flex flex-col gap-(--s-4) p-(--s-5)">
        <div class="flex flex-col gap-1.5">
          <label class="field-label" for="sample-discard-name">Name</label>
          <input
            id="sample-discard-name"
            hlmInput
            type="text"
            [ngModel]="name()"
            (ngModelChange)="name.set($event)"
          />
          @if (isDirty()) {
            <span class="text-[11px] text-(--warn) flex items-center gap-1">
              <span class="chip warn dot">Ungespeicherte Änderungen</span>
            </span>
          }
        </div>
        <klar-dialog-footer
          confirmLabel="Speichern"
          [confirmDisabled]="!name().trim()"
          [autoCloseOnCancel]="false"
          (cancel)="onCancel()"
        />
      </div>
    } @else {
      <div class="flex flex-col gap-(--s-4) p-(--s-5)">
        <p class="text-[14px] text-(--fg-1) leading-relaxed">
          Du hast ungespeicherte Änderungen. Wirklich verwerfen?
        </p>
        <klar-dialog-footer
          cancelLabel="Weiter bearbeiten"
          confirmLabel="Verwerfen"
          confirmTone="danger"
          [autoCloseOnCancel]="false"
          (cancel)="confirmingDiscard.set(false)"
          (confirm)="discard()"
        />
      </div>
    }
  `,
})
export class SampleDiscardDialogComponent {
  private dialog = inject(KlarDialogService);

  private readonly initial = 'Lebensmittel';
  readonly name = signal(this.initial);
  protected readonly confirmingDiscard = signal(false);
  protected readonly isDirty = computed(() => this.name() !== this.initial);

  protected onCancel(): void {
    if (this.isDirty()) {
      this.confirmingDiscard.set(true);
      return;
    }
    this.dialog.close();
  }

  protected discard(): void {
    this.dialog.close();
  }
}
