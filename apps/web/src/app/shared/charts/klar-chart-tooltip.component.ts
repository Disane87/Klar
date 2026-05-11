import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
} from '@angular/core';

/**
 * Floating tooltip card mirroring Spartan's HoverCard look — used by chart
 * components that need pixel-anchored hover info on many SVG elements
 * (where `[brnHoverCardTrigger]` per element would be impractical).
 *
 * Rendering rules (per app convention):
 * - The host node moves itself into `document.body` on init, so the card
 *   escapes any chart-section's `overflow: hidden` and is not clipped.
 * - Position is `fixed` and uses viewport-relative `clientX`/`clientY`
 *   coordinates from the consumer's pointer event.
 * - z-index is the maximum 32-bit value to win over modals, sticky bars,
 *   sheet portals, etc.
 */
@Component({
  selector: 'klar-chart-tooltip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'klar-chart-tooltip-portal' },
  template: `
    <div
      class="fixed -translate-x-1/2 -translate-y-full
             rounded-md border border-(--line) bg-(--bg-1)
             shadow-[0_8px_32px_rgba(0,0,0,0.35)]
             px-3 py-2 text-[12px] text-(--fg)
             whitespace-pre-line leading-snug
             pointer-events-none select-none"
      [style.left.px]="x()"
      [style.top.px]="y() - 10"
      [style.z-index]="2147483647"
      role="tooltip"
    >
      @if (title()) {
        <div class="text-[10px] uppercase tracking-widest text-(--fg-3) mb-1">
          {{ title() }}
        </div>
      }
      <div class="font-mono [font-variant-numeric:tabular-nums]">
        {{ body() }}
      </div>
    </div>
  `,
})
export class KlarChartTooltipComponent implements OnInit, OnDestroy {
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  /** Viewport-relative pointer coordinates (`event.clientX/Y`). */
  readonly x = input.required<number>();
  readonly y = input.required<number>();
  readonly title = input<string>('');
  readonly body  = input.required<string>();

  ngOnInit(): void {
    // Re-parent the host element to <body> so it escapes any chart-card
    // `overflow: hidden` and stacking contexts created by `transform`/
    // `filter` ancestors. Position remains `fixed` (viewport coords).
    document.body.appendChild(this.hostEl.nativeElement);
  }

  ngOnDestroy(): void {
    const el = this.hostEl.nativeElement;
    el.parentNode?.removeChild(el);
  }
}
