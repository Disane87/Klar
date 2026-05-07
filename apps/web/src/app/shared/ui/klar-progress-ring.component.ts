import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * SVG progress ring (Klar Design Pearl — Projekte-Tile).
 * Renders a circular progress indicator with the active arc in --tone
 * (defaults to --accent) and the remainder in --line-soft. Accepts a
 * value 0..1 (clamped). Visual mirror of the spec's project-progress
 * primitive in page-projects.jsx.
 */
@Component({
  selector: 'klar-progress-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center justify-center relative leading-none' },
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.viewBox]="'0 0 ' + size() + ' ' + size()"
      [attr.aria-label]="ariaLabel()"
      role="img"
    >
      <circle
        [attr.cx]="size() / 2"
        [attr.cy]="size() / 2"
        [attr.r]="radius()"
        fill="none"
        stroke="var(--line-soft)"
        [attr.stroke-width]="stroke()"
      />
      <circle
        [attr.cx]="size() / 2"
        [attr.cy]="size() / 2"
        [attr.r]="radius()"
        fill="none"
        [attr.stroke]="tone() || 'var(--accent)'"
        [attr.stroke-width]="stroke()"
        stroke-linecap="round"
        [attr.stroke-dasharray]="circumference()"
        [attr.stroke-dashoffset]="dashOffset()"
        [attr.transform]="'rotate(-90 ' + size() / 2 + ' ' + size() / 2 + ')'"
        style="transition: stroke-dashoffset var(--dur-3) var(--ease-out);"
      />
    </svg>
    @if (showValue()) {
      <span
        class="absolute inset-0 flex items-center justify-center text-[11px] font-medium tabular-nums"
        style="font-family: var(--font-display); letter-spacing: -0.02em;"
      >
        {{ percentLabel() }}
      </span>
    }
  `,
})
export class KlarProgressRingComponent {
  /** Progress value 0..1 (clamped). */
  readonly value = input<number>(0);
  readonly size = input<number>(36);
  readonly stroke = input<number>(3);
  /** CSS color value for the active arc — typically `var(--cat-*)` or `var(--accent)`. */
  readonly tone = input<string>('');
  readonly showValue = input<boolean>(false);
  readonly ariaLabel = input<string>('Fortschritt');

  protected readonly clampedValue = computed(() =>
    Math.max(0, Math.min(1, this.value() || 0)),
  );
  protected readonly radius = computed(() => (this.size() - this.stroke()) / 2);
  protected readonly circumference = computed(() => 2 * Math.PI * this.radius());
  protected readonly dashOffset = computed(
    () => this.circumference() * (1 - this.clampedValue()),
  );
  protected readonly percentLabel = computed(
    () => `${Math.round(this.clampedValue() * 100)}%`,
  );
}
