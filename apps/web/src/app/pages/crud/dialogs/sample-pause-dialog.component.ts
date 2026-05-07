import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { KlarDialogFooterComponent } from '../../../shared/ui/klar-dialog-footer.component';
import { KlarSwitchComponent } from '../../../shared/ui/klar-switch.component';

/** Demo: Pausieren — toggle paused state with switch + confirm. */
@Component({
  selector: 'klar-sample-pause-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlarSwitchComponent, KlarDialogFooterComponent],
  template: `
    <div class="flex flex-col gap-(--s-4) p-(--s-5)">
      <div class="card px-(--s-4)">
        <klar-switch
          [(checked)]="paused"
          label="Pausiert"
          description="Wird ab nächstem Fälligkeitsdatum nicht mehr generiert"
        />
      </div>
      <klar-dialog-footer
        [confirmLabel]="paused() ? 'Pausieren' : 'Reaktivieren'"
        [confirmTone]="paused() ? 'secondary' : 'primary'"
      />
    </div>
  `,
})
export class SamplePauseDialogComponent {
  readonly paused = signal(false);
}
