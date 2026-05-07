import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CsvImportService } from '../../core/csv-import/csv-import.service';
import { CategoriesStore } from '../../core/categories/categories.store';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { CategoryEditDialogComponent } from '../haushalt/category-edit-dialog.component';
import type { Category } from '@klar/shared';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { CsvUploadStepComponent } from './components/csv-upload-step.component';
import { CsvPreviewTableComponent } from './components/csv-preview-table.component';
import { CsvImportSummaryComponent } from './components/csv-import-summary.component';
import type {
  AnalyzeResponse,
  ConfirmResponse,
  ConfirmRowSelection,
} from '../../core/csv-import/csv-import.types';

type Step = 'upload' | 'preview' | 'done';

@Component({
  selector: 'app-csv-import-page',
  standalone: true,
  imports: [
    CommonModule,
    CsvUploadStepComponent,
    CsvPreviewTableComponent,
    CsvImportSummaryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex flex-col gap-4 p-4 md:p-6 max-w-5xl mx-auto w-full">
      @switch (step()) {
        @case ('upload') {
          <app-csv-upload-step (fileSelected)="onFileSelected($event)" />
        }
        @case ('preview') {
          @if (analyzeResult(); as result) {
            <app-csv-preview-table
              [analyzeResult]="result"
              [selections]="selections()"
              [categories]="categoryOptions()"
              [submitting]="submitting()"
              (selectionsChange)="selections.set($event)"
              (addCategory)="onAddCategory($event)"
              (submit)="onSubmit()"
            />
          }
        }
        @case ('done') {
          @if (confirmResult(); as r) {
            <app-csv-import-summary [result]="r" (restart)="reset()" />
          }
        }
      }
    </main>
  `,
})
export class CsvImportPageComponent {
  private readonly csv = inject(CsvImportService);
  private readonly categoriesStore = inject(CategoriesStore);
  private readonly toast = inject(KlarToastService);
  private readonly dialog = inject(KlarDialogService);

  constructor() {
    inject(PageHeaderService).set({
      title: 'CSV-Import',
      subtitle: 'SPARKASSE CAMT V2',
    });
  }

  readonly step = signal<Step>('upload');
  readonly fileBase64 = signal<string | null>(null);
  readonly filename = signal<string | null>(null);
  readonly analyzeResult = signal<AnalyzeResponse | null>(null);
  readonly selections = signal<Map<number, ConfirmRowSelection>>(new Map());
  readonly submitting = signal(false);
  readonly confirmResult = signal<ConfirmResponse | null>(null);

  readonly categoryOptions = computed(() =>
    this.categoriesStore.active().map(c => ({ id: c.id, name: c.name })),
  );

  async onFileSelected(file: File): Promise<void> {
    try {
      const b64 = await this.csv.fileToBase64(file);
      this.fileBase64.set(b64);
      this.filename.set(file.name);
      const result = await this.csv.analyze(b64);
      this.analyzeResult.set(result);
      this.selections.set(this.buildInitialSelections(result));
      this.step.set('preview');
    } catch (err) {
      this.toast.error((err as Error).message ?? 'CSV konnte nicht analysiert werden');
    }
  }

  async onSubmit(): Promise<void> {
    const b64 = this.fileBase64();
    const fn = this.filename();
    if (!b64 || !fn) return;
    this.submitting.set(true);
    try {
      const rows = Array.from(this.selections().values()).map(s =>
        !s.skip && !s.categoryId
          ? { ...s, skip: true, skipReason: 'user' as const }
          : s,
      );
      const result = await this.csv.confirm(b64, fn, rows);
      this.confirmResult.set(result);
      this.step.set('done');
      this.toast.success(`${result.imported} Buchungen importiert`);
    } catch (err) {
      this.toast.error((err as Error).message ?? 'Import fehlgeschlagen');
    } finally {
      this.submitting.set(false);
    }
  }

  onAddCategory(payload: { rowIndex: number; name: string }): void {
    this.dialog.open({
      title: 'Kategorie anlegen',
      component: CategoryEditDialogComponent,
      width: 'md',
      inputs: {
        category: null,
        prefillName: payload.name,
        onCreated: (created: Category) => {
          const next = new Map(this.selections());
          const sel = next.get(payload.rowIndex);
          if (sel) {
            next.set(payload.rowIndex, { ...sel, categoryId: created.id });
            this.selections.set(next);
          }
        },
      },
    });
  }

  reset(): void {
    this.step.set('upload');
    this.fileBase64.set(null);
    this.filename.set(null);
    this.analyzeResult.set(null);
    this.selections.set(new Map());
    this.confirmResult.set(null);
  }

  private buildInitialSelections(
    result: AnalyzeResponse,
  ): Map<number, ConfirmRowSelection> {
    const map = new Map<number, ConfirmRowSelection>();
    for (const r of result.rows) {
      const skip = r.status === 'DUPLICATE' || r.status === 'FIXED_COST_MATCH';
      const skipReason: 'duplicate' | 'fixed' | undefined =
        r.status === 'DUPLICATE' ? 'duplicate' : r.status === 'FIXED_COST_MATCH' ? 'fixed' : undefined;
      map.set(r.rowIndex, {
        rowIndex: r.rowIndex,
        skip,
        skipReason,
        categoryId: r.suggestedCategoryId,
        projectId: null,
        visibility: 'SHARED',
        createNewRecurring: false,
      });
    }
    return map;
  }
}
