import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CsvPreviewRowComponent } from './csv-preview-row.component';
import { HlmButtonDirective } from '../../../shared/ui/hlm/hlm-button.directive';
import type {
  AnalyzeResponse,
  ConfirmRowSelection,
} from '../../../core/csv-import/csv-import.types';

interface CategoryOption {
  id: string;
  name: string;
}

type FilterKey = 'all' | 'NEW' | 'DUPLICATE' | 'FIXED_COST_MATCH' | 'RECURRING_SUGGESTION';

@Component({
  selector: 'app-csv-preview-table',
  standalone: true,
  imports: [CommonModule, CsvPreviewRowComponent, HlmButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex gap-2 overflow-x-auto pb-1 sticky top-0 bg-background z-10">
        @for (chip of chips(); track chip.key) {
          <button
            type="button"
            class="rounded-full border px-3 py-1.5 text-xs whitespace-nowrap min-h-[44px] transition-colors"
            [class.border-primary]="filter() === chip.key"
            [class.text-primary]="filter() === chip.key"
            [class.border-border]="filter() !== chip.key"
            (click)="filter.set(chip.key)"
          >
            {{ chip.label }} ({{ chip.count }})
          </button>
        }
      </div>

      <div class="flex flex-col gap-1 rounded-lg border border-border bg-card divide-y divide-border">
        @for (row of filteredRows(); track row.rowIndex) {
          <app-csv-preview-row
            [row]="row"
            [selection]="getSelection(row.rowIndex)"
            [categories]="categories()"
            (selectionChange)="onSelectionChange($event)"
          />
        }
      </div>

      <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between sticky bottom-0 bg-background py-3 border-t border-border">
        <span class="text-sm text-muted-foreground">
          {{ importableCount() }} importieren · {{ skippedCount() }} übersprungen
        </span>
        <button
          hlmBtn
          variant="default"
          [disabled]="!canSubmit() || submitting()"
          (click)="submit.emit()"
        >
          @if (submitting()) {
            Importiere…
          } @else {
            {{ importableCount() }} Buchungen importieren
          }
        </button>
      </div>
    </div>
  `,
})
export class CsvPreviewTableComponent {
  readonly analyzeResult = input.required<AnalyzeResponse>();
  readonly selections = input.required<Map<number, ConfirmRowSelection>>();
  readonly categories = input.required<CategoryOption[]>();
  readonly submitting = input<boolean>(false);

  readonly selectionsChange = output<Map<number, ConfirmRowSelection>>();
  readonly submit = output<void>();

  readonly filter = signal<FilterKey>('all');

  readonly chips = computed(() => {
    const s = this.analyzeResult().summary;
    return [
      { key: 'all' as FilterKey, label: 'Alle', count: s.total },
      { key: 'NEW' as FilterKey, label: 'Neu', count: s.new },
      { key: 'RECURRING_SUGGESTION' as FilterKey, label: 'Vorschläge', count: s.recurringSuggestions },
      { key: 'FIXED_COST_MATCH' as FilterKey, label: 'Fixkosten', count: s.fixedCostMatches },
      { key: 'DUPLICATE' as FilterKey, label: 'Duplikate', count: s.duplicates },
    ];
  });

  readonly filteredRows = computed(() => {
    const f = this.filter();
    const rows = this.analyzeResult().rows;
    return f === 'all' ? rows : rows.filter(r => r.status === f);
  });

  readonly importableCount = computed(
    () => Array.from(this.selections().values()).filter(s => !s.skip && !!s.categoryId).length,
  );

  readonly skippedCount = computed(
    () => Array.from(this.selections().values()).filter(s => s.skip).length,
  );

  readonly canSubmit = computed(() => {
    if (this.importableCount() === 0) return false;
    return Array.from(this.selections().values()).every(s => s.skip || !!s.categoryId);
  });

  getSelection(rowIndex: number): ConfirmRowSelection {
    return this.selections().get(rowIndex) ?? { rowIndex, skip: true };
  }

  onSelectionChange(sel: ConfirmRowSelection): void {
    const next = new Map(this.selections());
    next.set(sel.rowIndex, sel);
    this.selectionsChange.emit(next);
  }
}
