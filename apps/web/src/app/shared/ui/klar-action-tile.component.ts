import { Component, input, output } from '@angular/core';
import { KlarIconComponent } from '../icons/klar-icon.component';

/**
 * Full-width pressable card row used for navigation choices: onboarding mode
 * picker, haushalt category list rows, etc. Has icon + title + subtitle
 * + trailing chevron. Always >= 56px for touch.
 */
@Component({
  selector: 'klar-action-tile',
  standalone: true,
  imports: [KlarIconComponent],
  template: `
    <button
      type="button"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel() ?? title()"
      (click)="action.emit()"
      class="group w-full flex items-center gap-3 p-4 min-h-[56px] rounded-xl border border-border
             bg-card text-left transition-colors
             hover:bg-muted/50 active:bg-muted
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
             disabled:opacity-50 disabled:pointer-events-none"
    >
      @if (icon()) {
        <span class="shrink-0 inline-flex items-center justify-center size-9 rounded-lg bg-muted/50 text-foreground">
          <klar-icon [name]="icon()!" [size]="18" />
        </span>
      }
      <span class="flex-1 min-w-0">
        <span class="block text-sm font-semibold text-foreground truncate">{{ title() }}</span>
        @if (subtitle()) {
          <span class="block text-xs text-muted-foreground truncate">{{ subtitle() }}</span>
        }
      </span>
      @if (showChevron()) {
        <klar-icon name="chevron-right" [size]="14" class="text-muted-foreground shrink-0" />
      }
    </button>
  `,
})
export class KlarActionTileComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly icon = input<string | null>(null);
  readonly disabled = input(false);
  readonly showChevron = input(true);
  readonly ariaLabel = input<string | null>(null);
  readonly action = output<void>();
}
