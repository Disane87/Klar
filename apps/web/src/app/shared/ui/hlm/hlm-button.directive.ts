import { Directive, computed, input } from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { hlm } from './hlm-utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded text-sm font-medium transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:     'bg-primary text-primary-foreground hover:opacity-90',
        accent:      'bg-[var(--indigo-400)] text-[var(--zinc-950)] hover:opacity-90',
        outline:     'border border-[var(--zinc-700)] bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
        ghost:       'border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
        subtle:      'bg-[var(--surface-2)] text-foreground border border-border hover:bg-accent',
        destructive: 'border border-destructive/50 bg-transparent text-destructive hover:bg-destructive/10',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-8 px-3.5 text-sm',
        lg: 'h-9 px-4 text-sm',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  }
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonSize    = NonNullable<VariantProps<typeof buttonVariants>['size']>;

@Directive({
  selector: '[hlmBtn]',
  standalone: true,
  host: { '[class]': '_cls()' },
})
export class HlmButtonDirective {
  variant   = input<ButtonVariant>('default');
  size      = input<ButtonSize>('md');
  userClass = input('', { alias: 'class' });

  _cls = computed(() => hlm(buttonVariants({ variant: this.variant(), size: this.size() }), this.userClass()));
}
