import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type KlarHeroVariant = 'admin' | 'haushalt' | 'vert' | 'profile';

const TITLE_SIZE: Record<KlarHeroVariant, string> = {
  admin:    'text-[26px]',
  haushalt: 'text-[32px]',
  vert:     'text-[22px]',
  profile:  'text-[22px]',
};

@Component({
  selector: 'klar-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'relative grid gap-(--s-5) p-(--s-5) items-center overflow-hidden ' +
      'border border-(--line-soft) rounded-(--r-8) bg-(--bg-1) ' +
      'grid-cols-[1fr_auto]',
  },
  template: `
    @if (decor()) {
      <span aria-hidden="true"
            class="absolute inset-0 pointer-events-none
                   bg-[linear-gradient(135deg,oklch(from_var(--accent)_l_c_h/0.10),transparent_60%)]"></span>
      <span aria-hidden="true"
            class="absolute inset-0 pointer-events-none
                   bg-[radial-gradient(60%_100%_at_100%_0%,oklch(from_var(--accent)_l_c_h/0.18),transparent_60%)]"></span>
    }
    <div class="relative z-1 min-w-0">
      @if (eyebrow()) {
        <div class="text-[10px] uppercase tracking-[0.18em] text-(--accent) font-medium flex items-center gap-1.5">
          <ng-content select="[heroEyebrowIcon]" />
          <span>{{ eyebrow() }}</span>
        </div>
      }
      <div [class]="titleClass()"
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
    <div class="relative z-1 flex gap-2 items-center">
      <ng-content select="[heroActions]" />
    </div>
  `,
})
export class KlarHeroComponent {
  readonly variant = input<KlarHeroVariant>('admin');
  readonly eyebrow = input<string | null>(null);
  readonly title   = input.required<string>();
  readonly sub     = input<string | null>(null);

  protected readonly decor = computed(() => {
    const v = this.variant();
    return v === 'admin' || v === 'vert';
  });

  protected readonly titleClass = computed(() =>
    `${TITLE_SIZE[this.variant()]} font-medium text-(--fg)`,
  );
}
