import { Component, inject, signal } from '@angular/core';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { KlarErrorBarComponent } from '../../shared/ui/klar-error-bar.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { HouseholdStore } from '../../core/household/household.store';
import { DataTransferService } from '../../core/data-transfer/data-transfer.service';
import type { ConfirmBody } from '../../core/data-transfer/data-transfer.service';
import { ImportMappingDialogComponent } from './import-mapping-dialog.component';

@Component({
  selector: 'app-data-import',
  standalone: true,
  imports: [HlmButtonDirective, HlmSpinnerComponent, KlarErrorBarComponent],
  templateUrl: './data-import.component.html',
})
export class DataImportComponent {
  private dtService = inject(DataTransferService);
  private hhStore = inject(HouseholdStore);
  private dialog = inject(KlarDialogService);
  private toast = inject(KlarToastService);

  readonly analyzing = signal(false);
  readonly fileError = signal('');

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      this.fileError.set('Nur .json Dateien werden akzeptiert');
      return;
    }

    this.fileError.set('');
    this.analyzing.set(true);

    try {
      const text = await file.text();
      const householdId = this.hhStore.activeId()!;
      const result = await this.dtService.analyze(householdId, text);

      const hasUnresolved =
        result.categoryMappings.some(m => m.resolvedId === null) ||
        result.projectMappings.some(m => m.resolvedId === null);

      if (hasUnresolved) {
        this.dialog.open({
          title: 'Import bestätigen',
          component: ImportMappingDialogComponent,
          inputs: { analyzeResult: result, fileContent: text },
          width: 'md',
        });
      } else {
        await this.confirmDirectly(text);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.toLowerCase().includes('schema')) {
        this.fileError.set('Ungültige Export-Datei');
      }
      // HTTP errors handled by ErrorInterceptor
    } finally {
      this.analyzing.set(false);
      input.value = '';
    }
  }

  private async confirmDirectly(text: string): Promise<void> {
    const householdId = this.hhStore.activeId()!;
    const body: ConfirmBody = { fileContent: text, categoryMappings: [], projectMappings: [] };
    const importResult = await this.dtService.confirm(householdId, body);
    const total = importResult.imported.transactions + importResult.imported.recurringTransactions;
    const skipped = importResult.skipped > 0 ? ` (${importResult.skipped} übersprungen)` : '';
    this.toast.success(`${total} Einträge importiert${skipped}`);
  }
}
