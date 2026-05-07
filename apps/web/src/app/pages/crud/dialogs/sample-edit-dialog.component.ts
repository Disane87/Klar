import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmInputDirective } from '../../../shared/ui/hlm/hlm-input.directive';
import { KlarDialogFooterComponent } from '../../../shared/ui/klar-dialog-footer.component';

/** Demo: Bearbeiten — pre-filled field + Speichern button. */
@Component({
  selector: 'klar-sample-edit-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, HlmInputDirective, KlarDialogFooterComponent],
  template: `
    <div class="flex flex-col gap-(--s-4) p-(--s-5)">
      <div class="flex flex-col gap-1.5">
        <label class="field-label" for="sample-edit-name">Name</label>
        <input
          id="sample-edit-name"
          hlmInput
          type="text"
          [ngModel]="name()"
          (ngModelChange)="name.set($event)"
        />
      </div>
      <klar-dialog-footer
        confirmLabel="Speichern"
        [confirmDisabled]="!name().trim()"
      />
    </div>
  `,
})
export class SampleEditDialogComponent {
  readonly name = signal('Lebensmittel');
}
