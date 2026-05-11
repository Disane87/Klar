import { Component, computed, inject, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { HlmSpinnerComponent } from './hlm/hlm-spinner.component';
import { hlm } from './hlm/hlm-utils';

export type KlarButtonTone =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'subtle'
  | 'danger'
  | 'link';

export type KlarButtonSize = 'sm' | 'md' | 'lg';
export type KlarButtonType = 'button' | 'submit' | 'reset';

const TONE: Record<KlarButtonTone, string> = {
  primary:
    'bg-(--accent-soft) text-(--accent) border border-transparent ' +
    'hover:bg-[oklch(from_var(--accent)_l_c_h_/_0.22)]',
  secondary:
    'bg-(--surface-2) text-foreground border border-border hover:bg-accent',
  ghost:
    'bg-transparent text-foreground border border-transparent hover:bg-(--bg-2)',
  outline:
    'bg-transparent text-foreground border border-(--swiss-30) hover:bg-accent hover:text-accent-foreground',
  subtle:
    'bg-(--surface-2) text-foreground border border-border hover:bg-accent',
  danger:
    'bg-transparent text-destructive border border-destructive/50 hover:bg-destructive/10',
  link:
    'bg-transparent text-(--color-accent) border-0 underline underline-offset-4 hover:opacity-80 px-0 h-auto',
};

const SIZE: Record<KlarButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-8 px-3.5 text-sm gap-1.5',
  lg: 'h-9 px-4 text-sm gap-2',
};

const ICON_SIZE: Record<KlarButtonSize, number> = { sm: 14, md: 14, lg: 16 };

const BASE =
  'inline-flex items-center justify-center whitespace-nowrap rounded font-medium ' +
  'transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ' +
  'disabled:pointer-events-none disabled:opacity-50';

@Component({
  selector: 'klar-button',
  standalone: true,
  imports: [KlarIconComponent, RouterLink, NgTemplateOutlet, HlmSpinnerComponent],
  template: `
    @if (routerLink()) {
      <a [routerLink]="routerLink()" [queryParams]="queryParams()" [class]="cls()">
        <ng-container *ngTemplateOutlet="content" />
      </a>
    } @else if (href()) {
      <a [href]="href()" [class]="cls()">
        <ng-container *ngTemplateOutlet="content" />
      </a>
    } @else {
      <button [type]="type()" [disabled]="disabled() || loading()" [attr.aria-busy]="loading() ? 'true' : null" [class]="cls()" (click)="onClick($event)">
        <ng-container *ngTemplateOutlet="content" />
      </button>
    }

    <ng-template #content>
      @if (loading()) {
        <hlm-spinner [size]="iconSize()" />
      } @else if (icon()) {
        @if (iconSpin()) {
          <span class="inline-flex animate-spin text-(--accent)">
            <klar-icon [name]="icon()!" [size]="iconSize()" />
          </span>
        } @else {
          <klar-icon [name]="icon()!" [size]="iconSize()" />
        }
      }
      <ng-content />
      @if (!loading() && iconRight()) {
        <klar-icon [name]="iconRight()!" [size]="iconSize()" />
      }
    </ng-template>
  `,
})
export class KlarButtonComponent {
  tone        = input<KlarButtonTone>('secondary');
  size        = input<KlarButtonSize>('md');
  type        = input<KlarButtonType>('button');
  disabled    = input(false);
  loading     = input(false);
  /**
   * When true, the leading icon spins (accent-coloured) instead of being
   * static. Used for in-flight refresh actions where we want the actual
   * refresh icon to rotate rather than swap to a generic spinner.
   */
  iconSpin    = input(false);
  icon        = input<string | null>(null);
  iconRight   = input<string | null>(null);
  routerLink  = input<string | unknown[] | null>(null);
  queryParams = input<Record<string, unknown> | null>(null);
  href        = input<string | null>(null);
  userClass   = input('', { alias: 'class' });

  click = output<MouseEvent>();

  iconSize = computed(() => ICON_SIZE[this.size()]);

  cls = computed(() => hlm(BASE, SIZE[this.size()], TONE[this.tone()], this.userClass()));

  onClick(ev: MouseEvent) {
    if (this.disabled() || this.loading()) return;
    // Stop the native click here so it does not bubble to the host
    // <klar-button> element — when callers bind `(click)` on the host,
    // Angular wires both the output AND the bubbled DOM event, which
    // would fire the handler twice. Stopping the bubble keeps the
    // emit-once semantics callers expect.
    ev.stopPropagation();
    this.click.emit(ev);
  }
}
