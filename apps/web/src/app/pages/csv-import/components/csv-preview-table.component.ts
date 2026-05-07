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
import { KlarIconComponent } from '../../../shared/icons/klar-icon.component';
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
type ChipTone = 'primary' | 'info' | 'success' | 'warn' | 'muted';

@Component({
  selector: 'app-csv-preview-table',
  standalone: true,
  imports: [
    CommonModule,
    ScrollingModule,
    CsvPreviewRowComponent,
    HlmButtonDirective,
    HlmCheckboxComponent,
    KlarIconComponent,
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

      <div class="flex items-center gap-3 px-6 py-2 bg-(--surface-2)/30 border border-border rounded-t-lg -mb-px">
        <hlm-checkbox
          [checked]="isAllSelected()"
          [indeterminate]="isAllIndeterminate()"
          [disabled]="totalSelectableCount() === 0"
          (checkedChange)="onSelectAll($event)"
        />
        <span class="text-[10px] uppercase tracking-[0.12em] font-medium text-(--text-muted)">
          Alle auswählen ({{ totalSelectedCount() }} / {{ totalSelectableCount() }})
        </span>
      </div>

      <cdk-virtual-scroll-viewport
        [itemSize]="rowHeightPx"
        class="rounded-b-lg border border-border bg-card h-[calc(100dvh-22rem)] min-h-96 overflow-x-hidden"
      >
        <ng-container *cdkVirtualFor="let item of items(); trackBy: trackByItem">
          @if (item.kind === 'header') {
            <div
              class="grid w-full items-center gap-3 px-6 bg-(--surface-2)/40 border-b border-(--border)/50 cursor-pointer hover:bg-(--surface-2)/60 transition-colors"
              [style.height.px]="rowHeightPx"
              style="grid-template-columns: 28px 1fr auto auto 16px;"
              (click)="toggleCollapse(item.monthKey)"
            >
              <hlm-checkbox
                (click)="$event.stopPropagation()"
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
              <klar-icon name="chevron-down" [size]="12"
                         class="text-(--text-muted) transition-transform shrink-0"
                         [class.-rotate-90]="isCollapsed(item.monthKey)" />
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

      <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between sticky bottom-0 bg-(--bg) py-3 border-t border-(--line)">
        <span class="text-[12px] text-(--fg-2) flex flex-wrap items-center gap-x-2 gap-y-1">
          <span><strong class="text-(--fg-1) font-medium mono">{{ importableCount() }}</strong> importieren</span>
          <span class="size-1 rounded-full bg-(--line-strong) inline-block"></span>
          <span><span class="mono">{{ skippedCount() }}</span> übersprungen</span>
          @if (missingCategoryCount() > 0) {
            <span class="size-1 rounded-full bg-(--line-strong) inline-block"></span>
            <span class="text-(--warn)"><span class="mono">{{ missingCategoryCount() }}</span> ohne Kategorie (werden übersprungen)</span>
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
  readonly collapsedMonths = signal<Set<string>>(new Set());

  readonly rowHeightPx = 56;

  isCollapsed(monthKey: string): boolean {
    return this.collapsedMonths().has(monthKey);
  }

  toggleCollapse(monthKey: string): void {
    this.collapsedMonths.update(set => {
      const next = new Set(set);
      next.has(monthKey) ? next.delete(monthKey) : next.add(monthKey);
      return next;
    });
  }

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
      if (this.collapsedMonths().has(key)) continue;
      for (const r of groupRows) {
        result.push({ kind: 'row', row: r });
      }
    }
    return result;
  });

  readonly trackByItem = (_: number, item: ListItem): string =>
    item.kind === 'header' ? `h:${item.monthKey}` : `r:${item.row.rowIndex}`;

  readonly allSelectableIndices = computed<number[]>(() => {
    const indices: number[] = [];
    for (const item of this.items()) {
      if (item.kind === 'header') indices.push(...item.selectableRowIndices);
    }
    return indices;
  });

  totalSelectableCount(): number {
    return this.allSelectableIndices().length;
  }

  totalSelectedCount(): number {
    return this.allSelectableIndices().filter(i => !this.selections().get(i)?.skip).length;
  }

  isAllSelected(): boolean {
    const total = this.allSelectableIndices();
    if (total.length === 0) return false;
    return total.every(i => !this.selections().get(i)?.skip);
  }

  isAllIndeterminate(): boolean {
    const total = this.allSelectableIndices();
    if (total.length === 0) return false;
    const sel = total.filter(i => !this.selections().get(i)?.skip).length;
    return sel > 0 && sel < total.length;
  }

  onSelectAll(include: boolean): void {
    const next = new Map(this.selections());
    for (const idx of this.allSelectableIndices()) {
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
      { key: 'all' as FilterKey, label: 'Alle', count: s.total, tone: 'primary' as ChipTone },
      { key: 'NEW' as FilterKey, label: 'Neu', count: s.new, tone: 'info' as ChipTone },
      { key: 'FIXED_COST_MATCH' as FilterKey, label: 'Fixkosten', count: s.fixedCostMatches, tone: 'success' as ChipTone },
      { key: 'RECURRING_SUGGESTION' as FilterKey, label: 'Fixkosten-Vorschläge', count: s.recurringSuggestions, tone: 'warn' as ChipTone },
      { key: 'DUPLICATE' as FilterKey, label: 'Duplikate', count: s.duplicates, tone: 'muted' as ChipTone },
    ];
  });

  pillClass(key: FilterKey, tone: ChipTone): string {
    const active = this.filter() === key;
    if (!active) {
      return 'border-(--line-soft) text-(--fg-2) hover:text-(--fg-1) hover:border-(--line)';
    }
    switch (tone) {
      case 'success': return 'border-(--success)/40 bg-(--success-soft) text-(--success)';
      case 'warn':    return 'border-(--warn)/40 bg-(--warn-soft) text-(--warn)';
      case 'info':    return 'border-(--accent)/40 bg-(--accent-soft) text-(--accent)';
      case 'muted':   return 'border-(--line) bg-(--bg-2) text-(--fg-1)';
      default:        return 'border-(--accent)/50 bg-(--accent-soft) text-(--accent)';
    }
  }

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
