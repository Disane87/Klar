import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrnPopoverImports, BrnPopover } from '@spartan-ng/brain/popover';
import { KlarIconComponent } from '../icons/klar-icon.component';

@Component({
  selector: 'klar-combobox',
  standalone: true,
  imports: [FormsModule, BrnPopoverImports, KlarIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full' },
  template: `
    <brn-popover #popover="brnPopover" [sideOffset]="4" align="start">
      <button
        #trigger
        type="button"
        brnPopoverTrigger
        [disabled]="disabled()"
        [attr.aria-label]="ariaLabel()"
        (click)="updateTriggerWidth()"
        class="flex h-9 w-full items-center justify-between gap-2 rounded border border-(--border) bg-(--surface) px-3 text-base text-(--text) scheme-dark transition-colors hover:bg-(--surface-2) disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-1 focus:ring-(--accent)/40"
      >
        <span class="truncate" [class.text-(--text-muted)]="!selectedItem()">
          {{ selectedItem() ? displayWith()(selectedItem()!) : placeholder() }}
        </span>
        <klar-icon name="chevron-down" [size]="14" class="shrink-0 text-(--text-muted)" />
      </button>

      <ng-template brnPopoverContent>
        <div
          class="min-w-64 rounded-md border border-(--border) bg-(--surface) shadow-[0_8px_30px_rgba(0,0,0,0.35)] overflow-hidden"
          [style.width.px]="triggerWidth()"
          (keydown)="onKeydown($event)"
        >
          <div class="flex items-center gap-2 border-b border-(--border) px-3 h-10">
            <klar-icon name="search" [size]="14" class="text-(--text-muted) shrink-0" />
            <input
              #searchInput
              type="text"
              class="flex-1 bg-transparent text-base outline-none placeholder:text-(--text-muted) text-(--text)"
              [placeholder]="searchPlaceholder()"
              [ngModel]="query()"
              (ngModelChange)="query.set($event); activeIndex.set(0)"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
            />
          </div>

          <div #list class="max-h-72 overflow-y-auto py-1" role="listbox">
            @if (loading()) {
              <div class="px-3 py-6 text-center text-sm text-(--text-muted)">Lädt…</div>
            } @else {
              @for (item of filteredItems(); track idOf()(item); let i = $index) {
                <button
                  type="button"
                  role="option"
                  [attr.aria-selected]="value() === idOf()(item)"
                  class="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors"
                  [class.bg-(--surface-2)]="activeIndex() === i"
                  [class.text-(--text)]="activeIndex() !== i"
                  (mouseenter)="activeIndex.set(i)"
                  (click)="onSelectItem(item)"
                >
                  <span class="truncate">{{ displayWith()(item) }}</span>
                  @if (value() === idOf()(item)) {
                    <klar-icon name="check" [size]="14" class="shrink-0 text-accent" />
                  }
                </button>
              }

              @if (showAdd()) {
                <button
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors border-t border-(--border)"
                  [class.bg-(--surface-2)]="activeIndex() === filteredItems().length"
                  (mouseenter)="activeIndex.set(filteredItems().length)"
                  (click)="onAdd()"
                >
                  <klar-icon name="plus" [size]="14" class="shrink-0 text-accent" />
                  <span class="truncate text-accent">{{ addLabel()!(query().trim()) }}</span>
                </button>
              } @else if (filteredItems().length === 0) {
                <div class="px-3 py-6 text-center text-sm text-(--text-muted)">{{ emptyLabel() }}</div>
              }
            }
          </div>
        </div>
      </ng-template>
    </brn-popover>
  `,
})
export class KlarComboboxComponent<T> {
  readonly items = input.required<readonly T[]>();
  readonly value = model<string | null>(null);

  readonly idOf = input.required<(item: T) => string>();
  readonly displayWith = input.required<(item: T) => string>();

  readonly placeholder = input('Auswählen…');
  readonly searchPlaceholder = input('Suchen…');
  readonly emptyLabel = input('Keine Einträge');
  readonly addLabel = input<((q: string) => string) | null>(null);
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly ariaLabel = input<string | undefined>(undefined);

  readonly addNew = output<string>();

  protected readonly popover = viewChild<BrnPopover>('popover');
  protected readonly trigger = viewChild<ElementRef<HTMLElement>>('trigger');

  protected readonly query = signal('');
  protected readonly activeIndex = signal(0);
  protected readonly triggerWidth = signal<number | null>(null);

  protected updateTriggerWidth(): void {
    const el = this.trigger()?.nativeElement;
    if (el) this.triggerWidth.set(el.getBoundingClientRect().width);
  }

  protected readonly selectedItem = computed(() => {
    const id = this.value();
    if (id === null) return null;
    return this.items().find(i => this.idOf()(i) === id) ?? null;
  });

  protected readonly filteredItems = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter(i =>
      this.displayWith()(i).toLowerCase().includes(q),
    );
  });

  protected readonly showAdd = computed(() => {
    const q = this.query().trim();
    if (!q) return false;
    if (!this.addLabel()) return false;
    const exact = this.items().some(
      i => this.displayWith()(i).trim().toLowerCase() === q.toLowerCase(),
    );
    return !exact;
  });

  onSelectItem(item: T): void {
    this.value.set(this.idOf()(item));
    this.closePopover();
  }

  onAdd(): void {
    const q = this.query().trim();
    if (!q) return;
    this.addNew.emit(q);
    this.closePopover();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const total = this.filteredItems().length + (this.showAdd() ? 1 : 0);
    if (total === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.update(i => (i + 1) % total);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.update(i => (i - 1 + total) % total);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const idx = this.activeIndex();
      const items = this.filteredItems();
      if (idx < items.length) {
        this.onSelectItem(items[idx]);
      } else if (this.showAdd()) {
        this.onAdd();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closePopover();
    }
  }

  private closePopover(): void {
    this.popover()?.close(null, 0);
    this.query.set('');
    this.activeIndex.set(0);
  }
}
