import { Component, computed, input, output } from '@angular/core';
import { KlarEmptyStateComponent } from './klar-empty-state.component';
import { KlarErrorBarComponent } from './klar-error-bar.component';
import { KlarSkeletonRowsComponent } from './klar-skeleton-rows.component';
import { KlarSkeletonCardsComponent } from './klar-skeleton-cards.component';

export type KlarAsyncStateSkeleton = 'rows' | 'cards' | 'none';

/**
 * Wraps the loading / error / empty / content trio that every list page
 * repeats. Pass loading/error signals from a store, plus the empty
 * predicate. Project actual content as <ng-content/>.
 *
 *   <klar-async-state
 *     [loading]="store.loading()"
 *     [error]="store.error()"
 *     [empty]="!store.items().length"
 *     emptyMessage="Keine Einträge"
 *     emptyCtaLabel="Anlegen"
 *     (retry)="store.reload()"
 *     (cta)="openCreate()">
 *     <!-- list / table content here -->
 *   </klar-async-state>
 */
@Component({
  selector: 'klar-async-state',
  standalone: true,
  imports: [
    KlarEmptyStateComponent,
    KlarErrorBarComponent,
    KlarSkeletonRowsComponent,
    KlarSkeletonCardsComponent,
  ],
  template: `
    @if (loading()) {
      @switch (skeleton()) {
        @case ('rows') { <klar-skeleton-rows [count]="skeletonCount()" /> }
        @case ('cards') { <klar-skeleton-cards [count]="skeletonCount()" /> }
        @default {}
      }
    } @else if (error()) {
      <klar-error-bar [message]="errorMessage()" (retry)="retry.emit()" />
    } @else if (empty()) {
      <klar-empty-state
        [message]="emptyMessage()"
        [icon]="emptyIcon()"
        [ctaLabel]="emptyCtaLabel() ?? undefined"
        (ctaClick)="cta.emit()"
      />
    } @else {
      <ng-content />
    }
  `,
})
export class KlarAsyncStateComponent {
  readonly loading = input(false);
  readonly error = input<unknown>(null);
  readonly empty = input(false);

  readonly skeleton = input<KlarAsyncStateSkeleton>('rows');
  readonly skeletonCount = input(6);

  readonly errorMessage = input('Fehler beim Laden der Daten.');
  readonly emptyMessage = input.required<string>();
  readonly emptyIcon = input('inbox');
  readonly emptyCtaLabel = input<string | null>(null);

  readonly retry = output<void>();
  readonly cta = output<void>();

  protected readonly _hasError = computed(() => this.error() !== null && this.error() !== undefined);
}
