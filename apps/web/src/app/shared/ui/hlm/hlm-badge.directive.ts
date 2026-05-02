import { Directive, computed, input } from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { hlm } from './hlm-utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0 text-[9px] font-medium uppercase tracking-widest transition-colors',
  {
    variants: {
      variant: {
        zinc:    'border-border bg-[var(--surface-2)] text-[var(--zinc-300)]',
        emerald: 'border-success/35 bg-success/8 text-success',
        rose:    'border-danger/35 bg-danger/8 text-danger',
        sky:     'border-[var(--color-surplus)]/35 bg-[var(--color-surplus)]/8 text-[var(--color-surplus)]',
        amber:   'border-[var(--color-variable)]/35 bg-[var(--color-variable)]/8 text-[var(--color-variable)]',
        indigo:  'border-primary/35 bg-primary/12 text-primary',
      },
    },
    defaultVariants: { variant: 'zinc' },
  }
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

@Directive({
  selector: '[hlmBadge]',
  standalone: true,
  host: { '[class]': '_cls()' },
})
export class HlmBadgeDirective {
  variant   = input<BadgeVariant>('zinc');
  dim       = input(false);
  userClass = input('', { alias: 'class' });

  _cls = computed(() => hlm(
    badgeVariants({ variant: this.variant() }),
    this.dim() ? 'opacity-55' : '',
    this.userClass()
  ));
}
