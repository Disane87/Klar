import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { CsvPreviewRowComponent } from './csv-preview-row.component';
import { HlmButtonDirective } from '../../../shared/ui/hlm/hlm-button.directive';
import { HlmCheckboxComponent } from '../../../shared/ui/hlm/hlm-checkbox.component';
import type {
  AnalyzeResponse,
  AnalyzeRow,
  ConfirmRowSelection,
} from '../../../core/csv-import/csv-import.types';

interface HeaderItem {
  kind: 'header';
  monthKey: string;
  label: string;
  rowIndices: number[];
  selectableRowIndices: number[];
}

interface RowItem {
  kind: 'row';
  row: AnalyzeRow;
}

type ListItem = HeaderItem | RowItem;

interface CategoryOption {
  id: string;
  name: string;
}

type FilterKey = 'all' | 'NEW' | 'DUPLICATE' | 'FIXED_COST_MATCH' | 'RECURRING_SUGGESTION';

@Component({
  selector: 'app-csv-preview-table',
  standalone: true,
  imports: [
    CommonModule,
    ScrollingModule,
    CsvPreviewRowComponent,
    HlmButtonDirective,
    HlmCheckboxComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host ::ng-deep .cdk-virtual-scroll-content-wrapper {
        width: 100%;
      }
    `,
  ],
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex gap-2 overflow-x-auto pb-1 sticky top-0 bg-background z-10">
        @for (chip of chips(); track chip.key) {
          <button
            type="button"
            class="rounded-full border px-3 py-1.5 text-xs whitespace-nowrap min-h-11 transition-colors"
            [class.border-primary]="filter() === chip.key"
            [class.text-primary]="filter() === chip.key"
            [class.border-border]="filter() !== chip.key"
            (click)="filter.set(chip.key)"
          >
            {{ chip.label }} ({{ chip.count }})
          </button>
        }
      </div>

      <cdk-virtual-scroll-viewport
        [itemSize]="rowHeightPx"
        class="rounded-lg border border-border bg-card h-[calc(100dvh-22rem)] min-h-96 overflow-x-hidden"
      >
        <ng-container *cdkVirtualFor="let item of items(); trackBy: trackByItem">
          @if (item.kind === 'header') {
            <div
              class="grid w-full items-center gap-3 px-6 bg-(--surface-2)/40 border-b border-(--border)/50"
              [style.height.px]="rowHeightPx"
              style="grid-template-columns: 28px 1fr auto auto;"
            >
              <hlm-checkbox
                [checked]="isGroupAllSelected(item)"
                [indeterminate]="isGroupIndeterminate(item)"
                [disabled]="item.selectableRowIndices.length === 0"
                (checkedChange)="onGroupToggle(item, $event)"
              />
              <div class="flex items-center gap-2 min-w-0">
                <span class="w-2 h-2 rounded-full shrink-0 bg-accent"></span>
                <span class="text-[10px] uppercase tracking-[0.12em] font-medium text-(--text-muted) truncate">
                  {{ item.label }}
                </span>
              </div>
              <span class="text-[11px] text-(--text-muted) whitespace-nowrap">
                {{ countSelectedInGroup(item) }} / {{ item.rowIndices.length }}
              </span>
              <span class="font-mono tabular-nums text-[13px] whitespace-nowrap"
                    [ngClass]="groupTotalCents(item) >= 0 ? 'text-success' : 'text-danger'">
                {{ formatCents(groupTotalCents(item)) }}
              </span>
            </div>
          } @else {
            <app-csv-preview-row
              [row]="item.row"
              [selection]="getSelection(item.row.rowIndex)"
              [categories]="categories()"
              [style.height.px]="rowHeightPx"
              class="block w-full"
              (selectionChange)="onSelectionChange($event)"
              (addCategory)="addCategory.emit($event)"
            />
          }
        </ng-container>
      </cdk-virtual-scroll-viewport>

      <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between sticky bottom-0 bg-background py-3 border-t border-border">
        <span class="text-sm text-muted-foreground">
          {{ importableCount() }} importieren · {{ skippedCount() }} übersprungen
          @if (missingCategoryCount() > 0) {
            <span class="ml-1 text-warning">· {{ missingCategoryCount() }} ohne Kategorie (werden übersprungen)</span>
          }
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
  readonly addCategory = output<{ rowIndex: number; name: string }>();
  readonly submit = output<void>();

  readonly filter = signal<FilterKey>('all');

  readonly rowHeightPx = 56;

  readonly items = computed<ListItem[]>(() => {
    const rows = this.filteredRows();
    if (rows.length === 0) return [];

    const groups = new Map<string, AnalyzeRow[]>();
    for (const row of rows) {
      const monthKey = row.date.slice(0, 7);
      if (!groups.has(monthKey)) groups.set(monthKey, []);
      groups.get(monthKey)!.push(row);
    }

    const sortedKeys = [...groups.keys()].sort((a, b) => b.localeCompare(a));
    const result: ListItem[] = [];
    for (const key of sortedKeys) {
      const groupRows = groups.get(key)!;
      const indices = groupRows.map(r => r.rowIndex);
      const selectable = groupRows
        .filter(r => r.status === 'NEW' || r.status === 'RECURRING_SUGGESTION')
        .map(r => r.rowIndex);
      result.push({
        kind: 'header',
        monthKey: key,
        label: this.formatMonthLabel(key),
        rowIndices: indices,
        selectableRowIndices: selectable,
      });
      for (const r of groupRows) {
        result.push({ kind: 'row', row: r });
      }
    }
    return result;
  });

  readonly trackByItem = (_: number, item: ListItem): string =>
    item.kind === 'header' ? `h:${item.monthKey}` : `r:${item.row.rowIndex}`;

  isGroupAllSelected(item: HeaderItem): boolean {
    if (item.selectableRowIndices.length === 0) return false;
    return item.selectableRowIndices.every(i => !this.selections().get(i)?.skip);
  }

  isGroupIndeterminate(item: HeaderItem): boolean {
    if (item.selectableRowIndices.length === 0) return false;
    const selectedCount = item.selectableRowIndices.filter(i => !this.selections().get(i)?.skip).length;
    return selectedCount > 0 && selectedCount < item.selectableRowIndices.length;
  }

  countSelectedInGroup(item: HeaderItem): number {
    return item.rowIndices.filter(i => !this.selections().get(i)?.skip).length;
  }

  groupTotalCents(item: HeaderItem): number {
    const rows = this.analyzeResult().rows;
    const byIndex = new Map(rows.map(r => [r.rowIndex, r]));
    let sum = 0;
    for (const idx of item.rowIndices) {
      if (this.selections().get(idx)?.skip) continue;
      const r = byIndex.get(idx);
      if (r) sum += r.amountCents;
    }
    return sum;
  }

  formatCents(cents: number): string {
    return (
      (cents / 100).toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + ' €'
    );
  }

  onGroupToggle(item: HeaderItem, include: boolean): void {
    const next = new Map(this.selections());
    for (const idx of item.selectableRowIndices) {
      const current = next.get(idx);
      if (!current) continue;
      next.set(idx, {
        ...current,
        skip: !include,
        skipReason: include ? undefined : 'user',
      });
    }
    this.selectionsChange.emit(next);
  }

  private formatMonthLabel(monthKey: string): string {
    const [year, month] = monthKey.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, 1));
    return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  }

  readonly chips = computed(() => {
    const s = this.analyzeResult().summary;
    return [
      { key: 'all' as FilterKey, label: 'Alle', count: s.total },
      { key: 'NEW' as FilterKey, label: 'Neu', count: s.new },
      { key: 'FIXED_COST_MATCH' as FilterKey, label: 'Fixkosten', count: s.fixedCostMatches },
      { key: 'RECURRING_SUGGESTION' as FilterKey, label: 'Fixkosten-Vorschläge', count: s.recurringSuggestions },
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

  readonly missingCategoryCount = computed(
    () => Array.from(this.selections().values()).filter(s => !s.skip && !s.categoryId).length,
  );

  readonly canSubmit = computed(() => this.importableCount() > 0);

  getSelection(rowIndex: number): ConfirmRowSelection {
    return this.selections().get(rowIndex) ?? { rowIndex, skip: true };
  }

  onSelectionChange(sel: ConfirmRowSelection): void {
    const next = new Map(this.selections());
    next.set(sel.rowIndex, sel);
    this.selectionsChange.emit(next);
  }
}
