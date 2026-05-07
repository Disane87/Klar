import { Directive, computed, input } from '@angular/core';
import {
  BrnAlertDialog,
  BrnAlertDialogContent,
  BrnAlertDialogDescription,
  BrnAlertDialogOverlay,
  BrnAlertDialogTitle,
  BrnAlertDialogTrigger,
} from '@spartan-ng/brain/alert-dialog';
import { hlm } from '../hlm-utils';

@Directive({
  selector: '[hlmAlertDialogOverlay]',
  standalone: true,
  hostDirectives: [BrnAlertDialogOverlay],
  host: {
    '[class]':
      `'fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out'`,
  },
})
export class HlmAlertDialogOverlayDirective {}

@Directive({
  selector: '[hlmAlertDialogContent]',
  standalone: true,
  hostDirectives: [BrnAlertDialogContent],
  host: { '[class]': '_cls()' },
})
export class HlmAlertDialogContentDirective {
  readonly userClass = input('', { alias: 'class' });
  readonly _cls = computed(() =>
    hlm(
      'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4',
      'border border-border bg-background p-6 shadow-lg sm:rounded-lg',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=open]:fade-in data-[state=closed]:fade-out',
      'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
      this.userClass(),
    ),
  );
}

@Directive({
  selector: '[hlmAlertDialogTitle]',
  standalone: true,
  hostDirectives: [BrnAlertDialogTitle],
  host: { '[class]': '_cls()' },
})
export class HlmAlertDialogTitleDirective {
  readonly userClass = input('', { alias: 'class' });
  readonly _cls = computed(() =>
    hlm('text-lg font-semibold leading-none tracking-tight', this.userClass()),
  );
}

@Directive({
  selector: '[hlmAlertDialogDescription]',
  standalone: true,
  hostDirectives: [BrnAlertDialogDescription],
  host: { '[class]': '_cls()' },
})
export class HlmAlertDialogDescriptionDirective {
  readonly userClass = input('', { alias: 'class' });
  readonly _cls = computed(() => hlm('text-sm text-muted-foreground', this.userClass()));
}

export const HlmAlertDialogImports = [
  BrnAlertDialog,
  BrnAlertDialogTrigger,
  HlmAlertDialogOverlayDirective,
  HlmAlertDialogContentDirective,
  HlmAlertDialogTitleDirective,
  HlmAlertDialogDescriptionDirective,
] as const;

export {
  BrnAlertDialog,
  BrnAlertDialogTrigger,
  BrnAlertDialogContent,
  BrnAlertDialogTitle,
  BrnAlertDialogDescription,
  BrnAlertDialogOverlay,
};
