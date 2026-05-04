import { Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { KlarSkeletonRowsComponent } from './klar-skeleton-rows.component';
import { KlarIconComponent } from '../icons/klar-icon.component';

@Component({
  selector: 'klar-list-group',
  standalone: true,
  imports: [NgClass, KlarSkeletonRowsComponent, KlarIconComponent],
  host: { class: 'block border-b border-(--border)' },
  template: `
    <div class="flex items-center justify-between px-6 py-3 border-b"
         [class.cursor-pointer]="collapsible()"
         [ngClass]="[
           danger()
             ? 'bg-(--color-expense)/4 border-(--color-expense)/20'
             : 'bg-(--surface-2)/40 border-(--border)/50',
           collapsible()
             ? 'hover:bg-(--surface-2)/70 active:bg-(--surface-2) transition-colors'
             : ''
         ]"
         (click)="collapsible() && headerAction.emit()">

      <!-- Left: optional dot + label -->
      <div class="flex items-center gap-2 min-w-0">
        @if (headerDotColor()) {
          <span class="w-2 h-2 rounded-full shrink-0" [style.background]="headerDotColor()"></span>
        }
        <span class="text-[10px] uppercase tracking-[0.12em] font-medium truncate"
              [ngClass]="danger() ? 'text-(--color-expense)' : 'text-(--text-muted)'">
          {{ label() }}
        </span>
      </div>

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

    @if (loading()) {
      <div class="px-6 py-3">
        <klar-skeleton-rows [count]="3" />
      </div>
    } @else if (!collapsed()) {
      <ng-content />
      @if (footnote()) {
        <p class="px-6 pb-3 pt-1 text-[11px] text-(--text-muted) leading-relaxed">{{ footnote() }}</p>
      }
    }
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
