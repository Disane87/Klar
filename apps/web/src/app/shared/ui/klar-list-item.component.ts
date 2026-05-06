import { Component, computed, input, output } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { KlarAvatarComponent } from './klar-avatar.component';

@Component({
  selector: 'klar-list-item',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet, KlarIconComponent, KlarAvatarComponent],
  host: { class: 'block w-full border-b border-(--border)/40 last:border-b-0' },
  template: `
    @if (navigable()) {
      <button type="button"
              class="w-full flex items-center gap-3 px-6 py-2.5 min-h-11 text-left transition-colors"
              [class.opacity-40]="disabled()"
              [class.pointer-events-none]="disabled()"
              [ngClass]="danger()
                ? 'hover:bg-(--color-expense)/6 active:bg-(--color-expense)/10'
                : 'hover:bg-(--surface-2)/60 active:bg-(--surface-2)'"
              (click)="itemClick.emit()">
        <ng-container *ngTemplateOutlet="row" />
        <klar-icon name="chevron-right" [size]="14" class="shrink-0 text-(--text-muted)" />
      </button>
    } @else {
      <div class="flex w-full items-center gap-3 px-6 py-2.5 min-h-11 overflow-hidden"
           [class.opacity-40]="disabled()">
        <ng-container *ngTemplateOutlet="row" />
      </div>
    }

    <ng-template #row>
      <!-- Slot: arbitrary leading content (e.g. checkbox), rendered before auto-leading -->
      <ng-content select="[klarLeading]" />

      <!-- Leading: status dot, avatar (url or seed), or icon -->
      @if (dotColor()) {
        <div class="size-2 rounded-full shrink-0"
             [ngClass]="dotColor() === 'income'
               ? 'bg-(--color-income) shadow-[0_0_4px_var(--color-income)]'
               : 'bg-(--text-muted)'"></div>
      } @else if (avatarUrl() !== undefined || avatarSeed()) {
        <klar-avatar [avatarUrl]="avatarUrl()"
                     [seed]="avatarSeed() ?? ''"
                     [size]="28"
                     [tooltip]="label()"
                     [tooltipSub]="sublabel()" />
      } @else if (icon()) {
        <klar-icon [name]="icon()!" [size]="16"
                   class="shrink-0"
                   [ngClass]="danger() ? 'text-(--color-expense)' : 'text-(--text-muted)'" />
      }

      <!-- Label + sublabel -->
      <div class="flex-1 min-w-0">
        <p class="text-[13px] font-medium truncate"
           [ngClass]="danger() ? 'text-(--color-expense)' : ''">
          {{ label() }}
        </p>
        @if (sublabel()) {
          <p class="text-[11px] text-(--text-muted) mt-0.5 truncate">{{ sublabel() }}</p>
        }
      </div>

      <!-- Trailing: badge -->
      @if (badge()) {
        <span class="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-xs"
              [ngClass]="badgeClass() ?? 'bg-(--surface-2) text-(--text-muted)'">
          {{ badge() }}
        </span>
      }

      <!-- Trailing: monospace value -->
      @if (value()) {
        <span class="shrink-0 font-mono tabular-nums text-[13px]"
              [ngClass]="valueClass() ?? 'text-(--text-muted)'">
          {{ value() }}
        </span>
      }

      <!-- Slot: arbitrary trailing content (e.g. select, toggle) before action button -->
      <ng-content select="[klarTrailing]" />

      <!-- Trailing: action button (label or icon) -->
      @if (_hasTrailing()) {
        <button type="button"
                class="shrink-0 min-h-11 px-2.5 text-[12px] font-medium transition-colors rounded-xs"
                [class.opacity-40]="trailingActionDisabled()"
                [class.pointer-events-none]="trailingActionDisabled()"
                [ngClass]="trailingActionDanger()
                  ? 'text-(--color-expense) hover:bg-(--color-expense)/10 active:bg-(--color-expense)/10'
                  : 'text-(--text-muted) hover:text-(--text) hover:bg-(--surface-2) active:bg-(--surface-2)'"
                (click)="$event.stopPropagation(); trailingActionClick.emit()">
          @if (trailingActionIcon() && !trailingActionLabel()) {
            <klar-icon [name]="trailingActionIcon()!" [size]="14" />
          } @else {
            {{ trailingActionLabel() }}
          }
        </button>
      }
    </ng-template>
  `,
})
export class KlarListItemComponent {
  label     = input.required<string>();
  sublabel  = input<string>();
  icon      = input<string>();
  avatarUrl = input<string | null>();
  avatarSeed = input<string>();
  dotColor  = input<'income' | 'muted'>();
  value      = input<string>();
  valueClass = input<string>();
  badge    = input<string>();
  badgeClass = input<string>();
  danger   = input(false);
  disabled = input(false);
  navigable = input(false);

  trailingActionLabel    = input<string>();
  trailingActionIcon     = input<string>();
  trailingActionDanger   = input(false);
  trailingActionDisabled = input(false);

  itemClick          = output<void>();
  trailingActionClick = output<void>();

  _hasTrailing = computed(() => !!this.trailingActionLabel() || !!this.trailingActionIcon());
}
