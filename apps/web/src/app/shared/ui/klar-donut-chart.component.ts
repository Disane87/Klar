import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface DonutSegment {
  /** Display label, used in legend and aria. */
  label: string;
  /** Numeric value (any unit; donut renders proportional arcs). */
  value: number;
  /** CSS color — usually a `var(--…)` token. */
  color: string;
}

interface RenderedSegment extends DonutSegment {
  d: string;
  percent: number;
}

/**
 * Lightweight donut chart used for proportional value comparisons (e.g. the
 * gross-to-net split into Netto / Steuern / Sozialabgaben). Pure SVG, no chart
 * library. Reuse for any "share of a whole" visualization with up to ~6 slices.
 */
@Component({
  selector: 'klar-donut-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex flex-col items-center gap-3' },
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.viewBox]="'0 0 ' + size() + ' ' + size()"
      role="img"
      [attr.aria-label]="ariaLabel()"
    >
      @for (seg of rendered(); track seg.label) {
        <path [attr.d]="seg.d" [attr.fill]="seg.color"></path>
      }
      <circle
        [attr.cx]="size() / 2"
        [attr.cy]="size() / 2"
        [attr.r]="innerRadius()"
        fill="var(--bg-1)"
      ></circle>
      @if (centerLabel()) {
        <text
          [attr.x]="size() / 2"
          [attr.y]="size() / 2 + 5"
          text-anchor="middle"
          class="fill-(--fg-1) font-mono"
          style="font-size: 14px; font-variant-numeric: tabular-nums;"
        >{{ centerLabel() }}</text>
      }
    </svg>
    @if (showLegend()) {
      <ul class="flex flex-col gap-1 text-[12px] w-full">
        @for (seg of rendered(); track seg.label) {
          <li class="flex items-center justify-between gap-3">
            <span class="flex items-center gap-2 text-(--fg-1)">
              <span class="inline-block w-3 h-3 rounded-sm" [style.background]="seg.color"></span>
              {{ seg.label }}
            </span>
            <span class="font-mono text-(--fg-2)" style="font-variant-numeric: tabular-nums;">
              {{ formatPercent(seg.percent) }}
            </span>
          </li>
        }
      </ul>
    }
  `,
})
export class KlarDonutChartComponent {
  readonly segments = input.required<DonutSegment[]>();
  readonly size = input<number>(160);
  readonly thickness = input<number>(28);
  readonly centerLabel = input<string | null>(null);
  readonly showLegend = input<boolean>(true);
  readonly ariaLabel = input<string>('Verteilung');

  readonly innerRadius = computed(() => this.size() / 2 - this.thickness());

  readonly rendered = computed<RenderedSegment[]>(() => {
    const segs = this.segments();
    const total = segs.reduce((s, x) => s + Math.max(0, x.value), 0);
    if (total <= 0) return [];

    const cx = this.size() / 2;
    const cy = this.size() / 2;
    const rOuter = this.size() / 2;
    const rInner = this.innerRadius();

    let startAngle = -Math.PI / 2; // start at top
    const out: RenderedSegment[] = [];

    for (const seg of segs) {
      const value = Math.max(0, seg.value);
      const fraction = value / total;
      if (fraction <= 0) continue;
      const endAngle = startAngle + fraction * 2 * Math.PI;
      const largeArc = fraction > 0.5 ? 1 : 0;

      const xOuterStart = cx + rOuter * Math.cos(startAngle);
      const yOuterStart = cy + rOuter * Math.sin(startAngle);
      const xOuterEnd   = cx + rOuter * Math.cos(endAngle);
      const yOuterEnd   = cy + rOuter * Math.sin(endAngle);
      const xInnerStart = cx + rInner * Math.cos(endAngle);
      const yInnerStart = cy + rInner * Math.sin(endAngle);
      const xInnerEnd   = cx + rInner * Math.cos(startAngle);
      const yInnerEnd   = cy + rInner * Math.sin(startAngle);

      // Special-case full circle: SVG arcs cannot draw a 360° arc as one path,
      // so we draw two half-circles by splitting at the diametrically opposite point.
      let d: string;
      if (fraction >= 0.999999) {
        const xMid = cx + rOuter * Math.cos(startAngle + Math.PI);
        const yMid = cy + rOuter * Math.sin(startAngle + Math.PI);
        const xMidI = cx + rInner * Math.cos(startAngle + Math.PI);
        const yMidI = cy + rInner * Math.sin(startAngle + Math.PI);
        d = [
          `M ${xOuterStart} ${yOuterStart}`,
          `A ${rOuter} ${rOuter} 0 1 1 ${xMid} ${yMid}`,
          `A ${rOuter} ${rOuter} 0 1 1 ${xOuterStart} ${yOuterStart}`,
          `M ${xInnerEnd} ${yInnerEnd}`,
          `A ${rInner} ${rInner} 0 1 0 ${xMidI} ${yMidI}`,
          `A ${rInner} ${rInner} 0 1 0 ${xInnerEnd} ${yInnerEnd}`,
          'Z',
        ].join(' ');
      } else {
        d = [
          `M ${xOuterStart} ${yOuterStart}`,
          `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${xOuterEnd} ${yOuterEnd}`,
          `L ${xInnerStart} ${yInnerStart}`,
          `A ${rInner} ${rInner} 0 ${largeArc} 0 ${xInnerEnd} ${yInnerEnd}`,
          'Z',
        ].join(' ');
      }

      out.push({ ...seg, d, percent: fraction * 100 });
      startAngle = endAngle;
    }

    return out;
  });

  formatPercent(p: number): string {
    return `${p.toFixed(1)} %`;
  }
}
