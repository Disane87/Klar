import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { KlarDialogFooterComponent } from '../../../shared/ui/klar-dialog-footer.component';
import { KlarSelectComponent, KlarSelectOption } from '../../../shared/ui/klar-select.component';

type CategoryId = 'essen' | 'wohnen' | 'mobil' | 'freizeit';

/** Demo: Verschieben — KSelect target picker + Verschieben button. */
@Component({
  selector: 'klar-sample-move-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlarSelectComponent, KlarDialogFooterComponent],
  template: `
    <div class="flex flex-col gap-(--s-4)">
      <div class="flex flex-col gap-1.5">
        <label class="field-label">Ziel-Kategorie</label>
        <klar-select
          [options]="opts"
          [(value)]="target"
          placeholder="Kategorie wählen"
        />
      </div>
      <klar-dialog-footer
        confirmLabel="Verschieben"
        [confirmDisabled]="!target()"
      />
    </div>
  `,
})
export class SampleMoveDialogComponent {
  readonly target = signal<CategoryId | ''>('');
  readonly opts: KlarSelectOption<CategoryId>[] = [
    { value: 'essen',    label: 'Essen' },
    { value: 'wohnen',   label: 'Wohnen' },
    { value: 'mobil',    label: 'Mobilität' },
    { value: 'freizeit', label: 'Freizeit' },
  ];
}
