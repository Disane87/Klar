import { Component, inject, input, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { HouseholdStore } from '../../core/household/household.store';
import { DataTransferService } from '../../core/data-transfer/data-transfer.service';
import type { AnalyzeResponse, ConfirmBody } from '../../core/data-transfer/data-transfer.service';

@Component({
  selector: 'app-import-mapping-dialog',
  standalone: true,
  imports: [FormsModule, HlmButtonDirective, HlmSpinnerComponent],
  templateUrl: './import-mapping-dialog.component.html',
})
export class ImportMappingDialogComponent {
  readonly analyzeResult = input.required<AnalyzeResponse>();
  readonly fileContent = input.required<string>();

  readonly dialog = inject(KlarDialogService);
  private toast = inject(KlarToastService);
  private dtService = inject(DataTransferService);
  private hhStore = inject(HouseholdStore);

  readonly saving = signal(false);

  // Map: "sourceName::sourceType" → targetId (for categories)
  readonly categorySelections = signal<Record<string, string>>({});
  // Map: sourceName → targetId (for projects)
  readonly projectSelections = signal<Record<string, string>>({});

  readonly unresolvedCategories = computed(() =>
    this.analyzeResult().categoryMappings.filter(m => m.resolvedId === null),
  );

  readonly unresolvedProjects = computed(() =>
    this.analyzeResult().projectMappings.filter(m => m.resolvedId === null),
  );

  readonly canConfirm = computed(() => {
    const catOk = this.unresolvedCategories().every(
      m => !!this.categorySelections()[`${m.source.name}::${m.source.type}`],
    );
    const projOk = this.unresolvedProjects().every(
      m => !!this.projectSelections()[m.source.name],
    );
    return catOk && projOk;
  });

  setCategoryMapping(key: string, targetId: string): void {
    this.categorySelections.update(s => ({ ...s, [key]: targetId }));
  }

  setProjectMapping(name: string, targetId: string): void {
    this.projectSelections.update(s => ({ ...s, [name]: targetId }));
  }

  async confirm(): Promise<void> {
    if (!this.canConfirm()) return;
    this.saving.set(true);
    const householdId = this.hhStore.activeId()!;

    const body: ConfirmBody = {
      fileContent: this.fileContent(),
      categoryMappings: this.unresolvedCategories().map(m => ({
        sourceName: m.source.name,
        sourceType: m.source.type,
        targetId: this.categorySelections()[`${m.source.name}::${m.source.type}`],
      })),
      projectMappings: this.unresolvedProjects().map(m => ({
        sourceName: m.source.name,
        targetId: this.projectSelections()[m.source.name],
      })),
    };

    try {
      const result = await this.dtService.confirm(householdId, body);
      const parts: string[] = [];
      if (result.imported.transactions > 0) parts.push(`${result.imported.transactions} Buchungen`);
      if (result.imported.recurringTransactions > 0) parts.push(`${result.imported.recurringTransactions} Fixkosten`);
      const msg = parts.join(' und ') || '0 Einträge';
      const skippedNote = result.skipped > 0 ? ` (${result.skipped} übersprungen)` : '';
      this.toast.success(`${msg} importiert${skippedNote}`);
      this.dialog.close();
    } catch {
      // ErrorInterceptor shows HTTP error toast — keep dialog open so user can retry
    } finally {
      this.saving.set(false);
    }
  }
}
