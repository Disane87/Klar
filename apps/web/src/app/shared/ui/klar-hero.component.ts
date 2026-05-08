import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Canonical hero strip for `/app/*` pages.
 *
 * One look across the whole app — anchored on the admin-page hero design
 * (gradient decor, larger Fraunces title, accent eyebrow). Per CLAUDE.md
 * "Heroes always use `<klar-hero>`" — no inline rounded-lg/border/p-5
 * sections that recreate this layout.
 *
 * Slots:
 * - `[heroEyebrowIcon]` — optional icon next to the eyebrow text
 * - `[heroBody]`        — extra body content under the subtitle
 * - `[heroActions]`     — right-aligned cluster (buttons, metric-tile
 *                         grid, status chips). Wraps below the title on
 *                         narrow viewports.
 */
@Component({
  selector: 'klar-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // App-wide rule: heroes are desktop-only. Mobile pages get the
  // <klar-mobile-header> from the shell instead. The hidden class on the host
  // takes the entire <klar-hero> element out of the layout (no margin gap left
  // behind by `gap-(--s-5)` on the parent flex column).
  host: {
    class:
      'hidden md:grid relative gap-(--s-5) p-(--s-5) items-center overflow-hidden ' +
      'border border-(--line-soft) rounded-(--r-8) bg-(--bg-1) ' +
      'md:grid-cols-[1fr_auto]',
  },
  template: `
    <span aria-hidden="true"
          class="absolute inset-0 pointer-events-none
                 bg-[linear-gradient(135deg,oklch(from_var(--accent)_l_c_h/0.10),transparent_60%)]"></span>
    <span aria-hidden="true"
          class="absolute inset-0 pointer-events-none
                 bg-[radial-gradient(60%_100%_at_100%_0%,oklch(from_var(--accent)_l_c_h/0.18),transparent_60%)]"></span>

    <div class="relative z-1 min-w-0">
      @if (eyebrow()) {
        <div class="text-[10px] uppercase tracking-[0.18em] text-(--accent) font-medium flex items-center gap-1.5">
          <ng-content select="[heroEyebrowIcon]" />
          <span>{{ eyebrow() }}</span>
        </div>
      }
      <div class="text-[26px] font-medium text-(--fg)"
           style="font-family: var(--font-display); letter-spacing: -0.02em; line-height: 1.1; margin-top: 4px;">
        {{ title() }}
      </div>
      @if (sub()) {
        <div class="text-[13px] text-(--fg-2) mt-2 leading-[1.55] max-w-[56ch]">
          {{ sub() }}
        </div>
      }
      <ng-content select="[heroBody]" />
    </div>
    <div class="relative z-1 flex flex-wrap gap-2 items-center md:justify-end">
      <ng-content select="[heroActions]" />
    </div>
  `,
})
export class KlarHeroComponent {
  readonly eyebrow = input<string | null>(null);
  readonly title   = input.required<string>();
  readonly sub     = input<string | null>(null);
}
