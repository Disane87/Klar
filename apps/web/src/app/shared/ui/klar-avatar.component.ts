import { Component, computed, input } from '@angular/core';

function seedToHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) & 0xffff;
  return hash % 360;
}

@Component({
  selector: 'klar-avatar',
  standalone: true,
  host: { class: 'relative inline-flex group/avatar' },
  template: `
    @if (avatarUrl()) {
      <img [src]="avatarUrl()!"
           [style.width.px]="size()"
           [style.height.px]="size()"
           alt=""
           [class]="noBorder() ? 'rounded-full object-cover shrink-0'
                                : 'rounded-full object-cover shrink-0 border border-[color-mix(in_oklab,var(--color-accent)_25%,transparent)]'" />
    } @else {
      <div class="rounded-full shrink-0 flex items-center justify-center select-none font-semibold text-white"
           [style.width.px]="size()"
           [style.height.px]="size()"
           [style.font-size.px]="size() * 0.38"
           [style.background-color]="_bg()">
        {{ _initials() }}
      </div>
    }

    @if (tooltip() && hoverCard()) {
      <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                  min-w-max px-2.5 py-1.5 rounded-md
                  bg-(--surface) border border-(--border)
                  shadow-[0_4px_16px_rgba(0,0,0,0.25)]
                  text-[12px] font-medium text-(--text)
                  opacity-0 scale-95 pointer-events-none
                  group-hover/avatar:opacity-100 group-hover/avatar:scale-100
                  transition-[opacity,transform] duration-150">
        {{ tooltip() }}
        @if (tooltipSub()) {
          <div class="text-[10px] text-(--text-muted) mt-0.5">{{ tooltipSub() }}</div>
        }
      </div>
    }
  `,
})
export class KlarAvatarComponent {
  avatarUrl  = input<string | null | undefined>();
  seed       = input<string>('');
  initials   = input<string>();
  size       = input<number>(28);
  noBorder   = input<boolean>(false);
  tooltip    = input<string>();
  tooltipSub = input<string>();
  hoverCard  = input<boolean>(true);

  _initials = computed(() => {
    if (this.initials()) return this.initials()!;
    return (this.seed() || '?').charAt(0).toUpperCase();
  });
  _bg = computed(() => `hsl(${seedToHue(this.seed())} 42% 38%)`);
}
