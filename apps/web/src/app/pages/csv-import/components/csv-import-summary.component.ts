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
    <div class="flex flex-col rounded-md border border-(--line) bg-(--bg-1) overflow-hidden">
      <header class="flex flex-col gap-1 px-5 py-4 border-b border-(--line-soft)">
        <div class="text-[10px] uppercase tracking-[0.14em] text-(--fg-2) font-medium">Import</div>
        <h2 class="serif text-[20px] leading-tight">Import abgeschlossen</h2>
      </header>
      <dl class="grid grid-cols-2 gap-y-2 text-[13px] px-5 py-4">
        <dt class="text-(--fg-2)">Importiert</dt>
        <dd class="mono text-(--success) text-right">{{ result().imported }}</dd>
        <dt class="text-(--fg-2)">Duplikate übersprungen</dt>
        <dd class="mono text-right text-(--fg-1)">{{ result().skippedDuplicates }}</dd>
        <dt class="text-(--fg-2)">Fixkosten übersprungen</dt>
        <dd class="mono text-right text-(--fg-1)">{{ result().skippedFixed }}</dd>
        <dt class="text-(--fg-2)">Vom User übersprungen</dt>
        <dd class="mono text-right text-(--fg-1)">{{ result().skippedByUser }}</dd>
        <dt class="text-(--fg-2)">Neue Fixkosten angelegt</dt>
        <dd class="mono text-right text-(--fg-1)">{{ result().createdRecurrings }}</dd>
      </dl>
      <div class="flex flex-col gap-2 md:flex-row md:justify-end px-5 py-3 border-t border-(--line-soft) bg-(--bg)/40">
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
