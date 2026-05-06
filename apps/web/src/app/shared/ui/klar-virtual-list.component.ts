import { ScrollingModule } from '@angular/cdk/scrolling';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  TemplateRef,
  TrackByFunction,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

/**
 * Virtual-scrolling list backed by Angular CDK. Emits `needMore` when the
 * viewport is within `loadAheadCount` items of the end so the parent can
 * fetch the next page. The component does not own pagination state — the
 * parent decides when to flip `hasMore` to false to stop emissions.
 *
 * Provide a row template via `<ng-template #row let-item>...</ng-template>` and
 * optionally an empty template via `<ng-template #empty>...</ng-template>`.
 */
@Component({
  selector: 'klar-virtual-list',
  standalone: true,
  imports: [ScrollingModule, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    @if (items().length === 0 && !loading()) {
      <ng-container *ngTemplateOutlet="emptyTpl ?? defaultEmpty" />
    } @else {
      <cdk-virtual-scroll-viewport
        [itemSize]="itemSize()"
        [minBufferPx]="bufferPx()"
        [maxBufferPx]="bufferPx() * 2"
        class="block h-full overflow-auto"
        (scrolledIndexChange)="onScrolledIndex($event)"
      >
        <div
          *cdkVirtualFor="let item of items(); trackBy: trackByFn(); let i = index"
          [style.height.px]="itemSize()"
          class="flex items-stretch"
        >
          <ng-container *ngTemplateOutlet="rowTpl; context: { $implicit: item, index: i }" />
        </div>
      </cdk-virtual-scroll-viewport>
      @if (loading()) {
        <div class="text-xs text-muted-foreground text-center py-2">Lade …</div>
      }
    }

    <ng-template #defaultEmpty>
      <div class="text-sm text-muted-foreground text-center py-8">Keine Einträge</div>
    </ng-template>
  `,
})
export class KlarVirtualListComponent<T> {
  readonly items = input.required<T[]>();
  readonly itemSize = input<number>(56);
  readonly loading = input<boolean>(false);
  readonly hasMore = input<boolean>(true);
  readonly loadAheadCount = input<number>(8);
  readonly bufferPx = input<number>(400);
  readonly trackBy = input<TrackByFunction<T> | null>(null);

  readonly needMore = output<void>();

  @ContentChild('row', { static: false })
  rowTpl!: TemplateRef<{ $implicit: T; index: number }>;
  @ContentChild('empty', { static: false })
  emptyTpl?: TemplateRef<unknown>;

  private readonly lastEmittedAt = signal(0);

  protected readonly trackByFn = computed<TrackByFunction<T>>(() => {
    const provided = this.trackBy();
    if (provided) return provided;
    return (index: number, item: T) => {
      const id = (item as { id?: unknown } | null)?.id;
      return id !== undefined ? (id as string | number) : index;
    };
  });

  protected onScrolledIndex(index: number): void {
    const total = this.items().length;
    const should = shouldEmitNeedMore({
      index,
      total,
      loadAheadCount: this.loadAheadCount(),
      hasMore: this.hasMore(),
      loading: this.loading(),
      lastEmittedAt: this.lastEmittedAt(),
    });
    if (!should) return;
    this.lastEmittedAt.set(total);
    this.needMore.emit();
  }
}

export interface NeedMoreState {
  index: number;
  total: number;
  loadAheadCount: number;
  hasMore: boolean;
  loading: boolean;
  lastEmittedAt: number;
}

export function shouldEmitNeedMore(s: NeedMoreState): boolean {
  if (s.loading || !s.hasMore || s.total === 0) return false;
  if (s.index + s.loadAheadCount < s.total) return false;
  return s.lastEmittedAt !== s.total;
}
