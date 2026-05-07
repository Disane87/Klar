import {
  Component,
  ContentChild,
  Directive,
  TemplateRef,
  computed,
  input,
  output,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { KlarEmptyStateComponent } from './klar-empty-state.component';
import { KlarErrorBarComponent } from './klar-error-bar.component';
import { KlarSkeletonRowsComponent } from './klar-skeleton-rows.component';
import { KlarSkeletonCardsComponent } from './klar-skeleton-cards.component';

export type KlarAsyncStateSkeleton = 'rows' | 'cards' | 'none';

/**
 * Marker directive for projecting a custom loading template into
 * `<klar-async-state>`. Pages with bespoke skeletons (stat-strip + rows,
 * project-card grid, etc.) use this slot; simple lists rely on the built-in
 * rows/cards variants.
 *
 *   <klar-async-state ...>
 *     <ng-template klarLoading><my-custom-skeleton /></ng-template>
 *     <!-- main content -->
 *   </klar-async-state>
 */
@Directive({ selector: '[klarLoading]', standalone: true })
export class KlarLoadingTplDirective {
  constructor(public readonly templateRef: TemplateRef<unknown>) {}
}

/**
 * Wraps the loading / error / empty / content trio that every list page
 * repeats. Pass loading/error signals from a store, plus the empty
 * predicate. Project actual content as default <ng-content/>; project an
 * optional custom skeleton via <ng-template klarLoading>.
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
    NgTemplateOutlet,
    KlarEmptyStateComponent,
    KlarErrorBarComponent,
    KlarSkeletonRowsComponent,
    KlarSkeletonCardsComponent,
  ],
  template: `
    @if (loading()) {
      @if (loadingTpl) {
        <ng-container *ngTemplateOutlet="loadingTpl.templateRef" />
      } @else {
        @switch (skeleton()) {
          @case ('rows') { <klar-skeleton-rows [count]="skeletonCount()" /> }
          @case ('cards') { <klar-skeleton-cards [count]="skeletonCount()" /> }
          @default {}
        }
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

  @ContentChild(KlarLoadingTplDirective)
  protected loadingTpl: KlarLoadingTplDirective | null = null;

  protected readonly _hasError = computed(() => this.error() !== null && this.error() !== undefined);
}
