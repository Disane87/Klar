import { ChangeDetectionStrategy, Component } from '@angular/core';
import { KlarDialogFooterComponent } from '../../../shared/ui/klar-dialog-footer.component';

/** Demo: Löschen — confirm with danger CTA. */
@Component({
  selector: 'klar-sample-delete-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlarDialogFooterComponent],
  template: `
    <div class="flex flex-col gap-(--s-4)">
      <p class="text-[14px] text-(--fg-1) leading-relaxed">
        Eintrag <strong>"Lebensmittel"</strong> wirklich löschen?
        Diese Aktion kann nicht rückgängig gemacht werden.
      </p>
      <klar-dialog-footer
        confirmLabel="Löschen"
        confirmTone="danger"
      />
    </div>
  `,
})
export class SampleDeleteDialogComponent {}
