import { ChangeDetectionStrategy, Component } from '@angular/core';
import { KlarDialogFooterComponent } from '../../../shared/ui/klar-dialog-footer.component';

/** Demo: Detail (Read-only) — fields rendered as setting rows + close button. */
@Component({
  selector: 'klar-sample-detail-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlarDialogFooterComponent],
  template: `
    <div class="flex flex-col gap-(--s-4) p-(--s-5)">
      <div class="card p-0">
        <div class="setting-row">
          <div class="setting-text">
            <div class="setting-label">Name</div>
            <div class="setting-sub">Lebensmittel</div>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-text">
            <div class="setting-label">Kategorie</div>
            <div class="setting-sub">Essen</div>
          </div>
        </div>
        <div class="setting-row last">
          <div class="setting-text">
            <div class="setting-label">Erstellt</div>
            <div class="setting-sub">2026-05-01</div>
          </div>
        </div>
      </div>
      <klar-dialog-footer cancelLabel="Schließen" [showConfirm]="false" />
    </div>
  `,
})
export class SampleDetailDialogComponent {}
