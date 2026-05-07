import { Directive, computed, input } from '@angular/core';
import {
  BrnSheet,
  BrnSheetClose,
  BrnSheetContent,
  BrnSheetDescription,
  BrnSheetOverlay,
  BrnSheetTitle,
  BrnSheetTrigger,
} from '@spartan-ng/brain/sheet';
import { hlm } from '../hlm-utils';

@Directive({
  selector: '[hlmSheetOverlay]',
  standalone: true,
  hostDirectives: [BrnSheetOverlay],
  host: {
    '[class]':
      `'fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out'`,
  },
})
export class HlmSheetOverlayDirective {}

@Directive({
  selector: '[hlmSheetContent]',
  standalone: true,
  hostDirectives: [{ directive: BrnSheetContent }],
  host: { '[class]': '_cls()' },
})
export class HlmSheetContentDirective {
  readonly side = input<'top' | 'bottom' | 'left' | 'right'>('right');
  readonly userClass = input('', { alias: 'class' });

  readonly _cls = computed(() => {
    const sideClasses = {
      top: 'inset-x-0 top-0 border-b data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top',
      bottom:
        'inset-x-0 bottom-0 border-t pb-[env(safe-area-inset-bottom)] data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
      left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
      right:
        'inset-y-0 right-0 h-full w-3/4 max-w-sm border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
    } as const;
    return hlm(
      'fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      sideClasses[this.side()],
      this.userClass(),
    );
  });
}

@Directive({
  selector: '[hlmSheetTitle]',
  standalone: true,
  hostDirectives: [BrnSheetTitle],
  host: { '[class]': '_cls()' },
})
export class HlmSheetTitleDirective {
  readonly userClass = input('', { alias: 'class' });
  readonly _cls = computed(() =>
    hlm('text-lg font-semibold text-foreground', this.userClass()),
  );
}

@Directive({
  selector: '[hlmSheetDescription]',
  standalone: true,
  hostDirectives: [BrnSheetDescription],
  host: { '[class]': '_cls()' },
})
export class HlmSheetDescriptionDirective {
  readonly userClass = input('', { alias: 'class' });
  readonly _cls = computed(() => hlm('text-sm text-muted-foreground', this.userClass()));
}

export const HlmSheetImports = [
  BrnSheet,
  BrnSheetTrigger,
  BrnSheetClose,
  HlmSheetOverlayDirective,
  HlmSheetContentDirective,
  HlmSheetTitleDirective,
  HlmSheetDescriptionDirective,
] as const;

export { BrnSheet, BrnSheetTrigger, BrnSheetClose };
