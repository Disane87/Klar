import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonDirective } from '../../../shared/ui/hlm/hlm-button.directive';
import type { ConfirmResponse } from '../../../core/csv-import/csv-import.types';

@Component({
  selector: 'app-csv-import-summary',
  standalone: true,
  imports: [HlmButtonDirective, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <h2 class="text-lg font-semibold">Import abgeschlossen</h2>
      <dl class="grid grid-cols-2 gap-y-2 text-sm">
        <dt class="text-muted-foreground">Importiert</dt>
        <dd class="font-mono tabular-nums text-success text-right">{{ result().imported }}</dd>
        <dt class="text-muted-foreground">Duplikate übersprungen</dt>
        <dd class="font-mono tabular-nums text-right">{{ result().skippedDuplicates }}</dd>
        <dt class="text-muted-foreground">Fixkosten übersprungen</dt>
        <dd class="font-mono tabular-nums text-right">{{ result().skippedFixed }}</dd>
        <dt class="text-muted-foreground">Vom User übersprungen</dt>
        <dd class="font-mono tabular-nums text-right">{{ result().skippedByUser }}</dd>
        <dt class="text-muted-foreground">Neue Fixkosten angelegt</dt>
        <dd class="font-mono tabular-nums text-right">{{ result().createdRecurrings }}</dd>
      </dl>
      <div class="flex flex-col gap-2 md:flex-row md:justify-end">
        <a hlmBtn variant="ghost" routerLink="/app/buchungen">Zu den Buchungen</a>
        <button hlmBtn variant="default" (click)="restart.emit()">
          Weitere CSV importieren
        </button>
      </div>
    </div>
  `,
})
export class CsvImportSummaryComponent {
  readonly result = input.required<ConfirmResponse>();
  readonly restart = output<void>();
}
