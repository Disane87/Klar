import { Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { KlarSkeletonRowsComponent } from './klar-skeleton-rows.component';
import { KlarIconComponent } from '../icons/klar-icon.component';

@Component({
  selector: 'klar-list-group',
  standalone: true,
  imports: [NgClass, KlarSkeletonRowsComponent, KlarIconComponent],
  host: { class: 'setting-group block' },
  template: `
    <div class="setting-group-head"
         [class.cursor-pointer]="collapsible()"
         [class.cat-bar]="headerDotColor()"
         [style.--cat-color]="headerDotColor()"
         [ngClass]="danger() ? 'text-(--danger)' : ''"
         (click)="collapsible() && headerAction.emit()">

      <span class="truncate">{{ label() }}</span>

      <!-- Right: optional value + action button + chevron -->
      <div class="flex items-center gap-2 ml-3 shrink-0">
        @if (headerValue()) {
          <span class="font-mono tabular-nums text-[13px]"
                [ngClass]="headerValueClass() ?? 'text-(--text-muted)'">
            {{ headerValue() }}
          </span>
        }
        @if (headerActionLabel()) {
          <button type="button"
                  class="text-[11px] font-medium transition-opacity"
                  [class.opacity-50]="headerActionDisabled()"
                  [class.pointer-events-none]="headerActionDisabled()"
                  [ngClass]="headerActionDanger()
                    ? 'text-(--color-expense) hover:opacity-70 active:opacity-50'
                    : 'text-(--text-muted) hover:opacity-70 active:opacity-50'"
                  (click)="$event.stopPropagation(); headerAction.emit()">
            {{ headerActionLabel() }}
          </button>
        }
        @if (collapsible()) {
          <klar-icon name="chevron-down" [size]="14"
                     class="text-(--text-muted) transition-transform duration-200 shrink-0"
                     [class.-rotate-90]="collapsed()" />
        }
      </div>
    </div>

    <div class="setting-card">
      @if (loading()) {
        <div class="px-6 py-3">
          <klar-skeleton-rows [count]="3" />
        </div>
      } @else if (!collapsed()) {
        <ng-content />
        @if (footnote()) {
          <p class="px-(--s-5) py-(--s-3) text-[11px] text-(--fg-2) leading-relaxed border-t border-(--line-soft)">{{ footnote() }}</p>
        }
      }
    </div>
  `,
})
export class KlarListGroupComponent {
  label                  = input.required<string>();
  headerActionLabel      = input<string>();
  headerActionDanger     = input(false);
  headerActionDisabled   = input(false);
  danger                 = input(false);
  loading                = input(false);
  footnote               = input<string>();
  collapsible            = input(false);
  collapsed              = input(false);
  headerValue            = input<string>();
  headerValueClass       = input<string>();
  headerDotColor         = input<string>();

  headerAction = output<void>();
}
