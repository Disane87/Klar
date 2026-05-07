import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Confidence bar (Klar Design Pearl — Verträge auto-detection).
 * Renders a horizontal 0..1 bar where the fill color reflects confidence:
 * ≥ 0.8 → success, 0.5..0.8 → warn, < 0.5 → danger. Optional value label.
 */
@Component({
  selector: 'klar-confidence-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full' },
  template: `
    <div class="flex items-center gap-(--s-3) min-w-0">
      <div
        class="relative flex-1 h-1.5 rounded-full overflow-hidden bg-(--line-soft)"
        role="progressbar"
        [attr.aria-valuenow]="percentLabel()"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span
          class="absolute inset-y-0 left-0 rounded-full"
          [style.width]="percentLabel() + '%'"
          [style.background]="toneColor()"
          style="transition: width var(--dur-3) var(--ease-out), background var(--dur-1) var(--ease-out);"
        ></span>
      </div>
      @if (showValue()) {
        <span
          class="text-[11px] mono shrink-0 tabular-nums"
          [style.color]="toneColor()"
        >
          {{ percentLabel() }}%
        </span>
      }
    </div>
  `,
})
export class KlarConfidenceBarComponent {
  /** Value 0..1 (clamped). */
  readonly value = input<number>(0);
  readonly showValue = input<boolean>(true);

  protected readonly clamped = computed(() =>
    Math.max(0, Math.min(1, this.value() || 0)),
  );
  protected readonly percentLabel = computed(() =>
    Math.round(this.clamped() * 100),
  );
  /** Threshold-based tone: ≥0.8 success, ≥0.5 warn, otherwise danger. */
  protected readonly toneColor = computed(() => {
    const v = this.clamped();
    if (v >= 0.8) return 'var(--success)';
    if (v >= 0.5) return 'var(--warn)';
    return 'var(--danger)';
  });
}
