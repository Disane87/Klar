import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmInputDirective } from '../../../shared/ui/hlm/hlm-input.directive';
import { KlarDialogFooterComponent } from '../../../shared/ui/klar-dialog-footer.component';

/** Demo: Anlegen — single field + Speichern. Not wired to any backend. */
@Component({
  selector: 'klar-sample-create-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, HlmInputDirective, KlarDialogFooterComponent],
  template: `
    <div class="flex flex-col gap-(--s-4)">
      <div class="flex flex-col gap-1.5">
        <label class="field-label" for="sample-create-name">Name</label>
        <input
          id="sample-create-name"
          hlmInput
          type="text"
          placeholder="z. B. Lebensmittel"
          [ngModel]="name()"
          (ngModelChange)="name.set($event)"
        />
      </div>
      <klar-dialog-footer
        confirmLabel="Anlegen"
        [confirmDisabled]="!name().trim()"
      />
    </div>
  `,
})
export class SampleCreateDialogComponent {
  readonly name = signal('');
}
