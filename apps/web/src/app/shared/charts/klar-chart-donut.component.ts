import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { KlarChartTooltipComponent } from './klar-chart-tooltip.component';

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface ArcSegment {
  id: string;
  label: string;
  color: string;
  value: number;
  pct: number;
  path: string;
}

interface HoverState {
  id: string;
  /** container-local px */
  x: number;
  y: number;
}

const TWO_PI = Math.PI * 2;

/**
 * SVG donut for a category mix. Pure positive values (use absolute amounts).
 * Hover highlights the active arc and reveals a Spartan-style tooltip card
 * with the absolute amount and percentage.
 */
@Component({
  selector: 'klar-chart-donut',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlarChartTooltipComponent],
  host: { class: 'block w-full' },
  template: `
    @if (segments().length === 0 || total() === 0) {
      <div class="px-5 py-6 text-center text-[12px] text-(--fg-2)">
        Keine Daten.
      </div>
    } @else {
      <div class="flex flex-col md:flex-row items-center gap-4 px-4 py-4">
        <div #donutEl class="relative shrink-0" style="width: 168px; height: 168px;">
          <svg
            viewBox="0 0 100 100"
            class="block w-full h-full"
            (pointerleave)="hover.set(null)"
          >
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--line-soft)" stroke-width="14" />
            @for (a of arcs(); track a.id) {
              <path
                [attr.d]="a.path"
                [attr.stroke]="a.color"
                [attr.stroke-width]="hover()?.id === a.id ? 18 : 14"
                fill="none"
                stroke-linecap="butt"
                style="cursor: crosshair; transition: stroke-width 120ms ease-out;"
                [attr.opacity]="hover() === null || hover()?.id === a.id ? 1 : 0.45"
                (pointerenter)="onEnter($event, a)"
                (pointermove)="onEnter($event, a)"
              />
            }
          </svg>
          <div
            class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
          >
            <ng-content select="[centerTop]" />
            <ng-content select="[centerMain]" />
            <ng-content select="[centerSub]" />
          </div>

          @if (hover(); as h) {
            <klar-chart-tooltip
              [x]="h.x"
              [y]="h.y"
              [title]="hoverTitle(h.id)"
              [body]="hoverBody(h.id)"
            />
          }
        </div>

        <ul class="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 w-full">
          @for (a of arcs(); track a.id) {
            <li
              class="flex items-center gap-2 min-w-0 rounded px-1 py-0.5 cursor-default transition-colors"
              [class.bg-\(--bg-2\)]="hover()?.id === a.id"
              (pointerenter)="hoverFromList(a, donutEl)"
              (pointerleave)="hover.set(null)"
            >
              <span
                class="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                [style.background]="a.color"
                aria-hidden="true"
              ></span>
              <span class="text-[12px] text-(--fg) truncate flex-1">{{ a.label }}</span>
              <span class="text-[11px] mono text-(--fg-2) shrink-0">{{ a.pct.toFixed(0) }}%</span>
            </li>
          }
        </ul>
      </div>
    }
  `,
})
export class KlarChartDonutComponent {
  readonly segments = input<DonutSegment[]>([]);

  protected readonly hover = signal<HoverState | null>(null);

  protected readonly total = computed(() =>
    this.segments().reduce((s, x) => s + Math.max(0, Math.abs(x.value)), 0),
  );

  protected readonly arcs = computed<ArcSegment[]>(() => {
    const total = this.total();
    if (total === 0) return [];
    const segs = [...this.segments()]
      .map(s => ({ ...s, value: Math.abs(s.value) }))
      .sort((a, b) => b.value - a.value);

    const cx = 50;
    const cy = 50;
    const r = 40;
    const out: ArcSegment[] = [];
    let cursor = -Math.PI / 2;
    for (const s of segs) {
      const pct = (s.value / total) * 100;
      const angle = (s.value / total) * TWO_PI;
      const end = cursor + angle;
      const x1 = cx + Math.cos(cursor) * r;
      const y1 = cy + Math.sin(cursor) * r;
      const x2 = cx + Math.cos(end) * r;
      const y2 = cy + Math.sin(end) * r;
      const largeArc = angle > Math.PI ? 1 : 0;
      const path = `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`;
      out.push({
        id: s.id,
        label: s.label,
        color: s.color,
        value: s.value,
        pct,
        path,
      });
      cursor = end;
    }
    return out;
  });

  protected onEnter(ev: PointerEvent, a: ArcSegment): void {
    this.hover.set({ id: a.id, x: ev.clientX, y: ev.clientY });
  }

  protected hoverFromList(a: ArcSegment, donutEl: HTMLElement): void {
    // List-row hover: anchor card to the donut's viewport center for a
    // stable, screen-space-correct feel even though the row is far away.
    const rect = donutEl.getBoundingClientRect();
    this.hover.set({
      id: a.id,
      x:  rect.left + rect.width / 2,
      y:  rect.top + rect.height / 2,
    });
  }

  protected hoverTitle(id: string): string {
    return this.arcs().find(a => a.id === id)?.label ?? '';
  }

  protected hoverBody(id: string): string {
    const a = this.arcs().find(x => x.id === id);
    if (!a) return '';
    const eur = `${(a.value / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    return `${eur}\n${a.pct.toFixed(1)} %`;
  }
}
