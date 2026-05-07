import { Component, computed, input, output } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { KlarAvatarComponent } from './klar-avatar.component';

@Component({
  selector: 'klar-list-item',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet, KlarIconComponent, KlarAvatarComponent],
  host: { class: 'block w-full' },
  template: `
    @if (navigable()) {
      <button type="button"
              class="setting-row interactive w-full text-left"
              [class.danger]="danger()"
              [class.opacity-40]="disabled()"
              [class.pointer-events-none]="disabled()"
              (click)="itemClick.emit()">
        <ng-container *ngTemplateOutlet="row; context: { showChevron: true }" />
      </button>
    } @else {
      <div class="setting-row"
           [class.danger]="danger()"
           [class.opacity-40]="disabled()">
        <ng-container *ngTemplateOutlet="row; context: { showChevron: false }" />
      </div>
    }

    <ng-template #row let-showChevron="showChevron">
      <!-- Slot: arbitrary leading content (e.g. checkbox), rendered before auto-leading -->
      <ng-content select="[klarLeading]" />

      <!-- Leading: status dot, avatar (url or seed), or icon-box (bundle .setting-icon) -->
      @if (dotColor()) {
        <span class="setting-icon" [style.color]="dotColor() === 'income' ? 'var(--success)' : 'var(--fg-3)'"
              [style.background]="dotColor() === 'income' ? 'var(--success-soft)' : 'var(--bg-2)'">
          <span class="size-1.5 rounded-full" style="background: currentColor;"></span>
        </span>
      } @else if (avatarUrl() !== undefined || avatarSeed()) {
        <klar-avatar [avatarUrl]="avatarUrl()"
                     [seed]="avatarSeed() ?? ''"
                     [size]="28"
                     [tooltip]="label()"
                     [tooltipSub]="sublabel()"
                     [hoverCard]="hoverCard()" />
      } @else if (icon()) {
        <span class="setting-icon">
          <klar-icon [name]="icon()!" [size]="14" />
        </span>
      }

      <!-- Label + sublabel (bundle .setting-text) -->
      <div class="setting-text">
        <span class="setting-label">{{ label() }}</span>
        @if (sublabel()) {
          <span class="setting-hint">{{ sublabel() }}</span>
        }
      </div>

      <!-- Trailing actions group (bundle .setting-rhs) -->
      <div class="setting-rhs">
        @if (badge()) {
          <span class="chip"
                [ngClass]="badgeClass() ?? ''">
            {{ badge() }}
          </span>
        }
        @if (value()) {
          <span class="setting-meta"
                [ngClass]="valueClass() ?? ''">
            {{ value() }}
          </span>
        }
        <ng-content select="[klarTrailing]" />
        @if (_hasTrailing()) {
          <button type="button"
                  class="btn ghost sm"
                  [class.danger]="trailingActionDanger()"
                  [class.opacity-40]="trailingActionDisabled()"
                  [class.pointer-events-none]="trailingActionDisabled()"
                  (click)="$event.stopPropagation(); trailingActionClick.emit()">
            @if (trailingActionIcon() && !trailingActionLabel()) {
              <klar-icon [name]="trailingActionIcon()!" [size]="14" />
            } @else {
              {{ trailingActionLabel() }}
            }
          </button>
        }
        @if (showChevron) {
          <klar-icon name="chevron-right" [size]="14" class="shrink-0 text-(--fg-3)" />
        }
      </div>
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
  hoverCard = input(true);

  trailingActionLabel    = input<string>();
  trailingActionIcon     = input<string>();
  trailingActionDanger   = input(false);
  trailingActionDisabled = input(false);

  itemClick          = output<void>();
  trailingActionClick = output<void>();

  _hasTrailing = computed(() => !!this.trailingActionLabel() || !!this.trailingActionIcon());
}
