import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

/**
 * Hero metric tile (Klar Design Pearl).
 * Layout: eyebrow (10px uppercase 0.14em --fg-2) over a Fraunces hero number
 * with an optional sub-label.
 *
 * Visual mirror of `.summary-cell` from the design bundle (styles.css ~833-877).
 */
@Component({
  selector: 'klar-metric-tile',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  // Mobile: compact (smaller padding + value font, hide sub-line).
  // Desktop (md+): full Pearl proportions.
  template: `
    <div
      class="flex flex-col gap-1 md:gap-2 rounded-lg border bg-(--bg-1) px-3 py-2.5 md:px-5 md:py-4 relative overflow-hidden h-full"
      [ngClass]="accent()
        ? 'border-(--success)/40 bg-[radial-gradient(120%_80%_at_100%_0%,oklch(from_var(--success)_l_c_h_/_0.10),transparent_60%),var(--bg-1)]'
        : 'border-(--line)'">
      <span class="text-[9px] md:text-[10px] uppercase tracking-[0.14em] font-medium text-(--fg-2) truncate">
        {{ label() }}
      </span>
      <span
        class="font-(family-name:--font-display) text-[18px] md:text-[28px] leading-none font-normal tracking-[-0.02em] tabular-nums truncate"
        [ngClass]="valueClass() || (accent() ? 'text-(--success)' : 'text-(--fg)')">
        <ng-content select="[slot=value]">{{ value() }}</ng-content>
      </span>
      @if (sub() || hasSubSlot) {
        <span class="hidden md:flex text-[11px] font-(family-name:--font-mono) text-(--fg-2) items-center gap-1.5 truncate">
          <ng-content select="[slot=sub]">{{ sub() }}</ng-content>
        </span>
      }
    </div>
  `,
})
export class KlarMetricTileComponent {
  readonly label      = input.required<string>();
  readonly value      = input<string>('');
  readonly sub        = input<string>('');
  readonly accent     = input<boolean>(false);
  readonly valueClass = input<string>('');

  // Always render the sub line slot wrapper if user passes [slot=sub].
  protected readonly hasSubSlot = false;
}
