import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ThemeService } from '../../core/theme/theme.service';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';

/**
 * Mode toolbar (Klar Design Pearl mockup helper).
 * Sticky top-center pill with two segmented controls:
 *  - Desktop / Mobile preview width (toggles `.mode-mobile` class on the
 *    document root which clamps the app-frame to ≤ 390px for review).
 *  - Light / Dark theme.
 *
 * The bell from the bundle's mode-toolbar lives in the page header (per
 * Marco's request); this toolbar focuses on the live preview helpers.
 */
@Component({
  selector: 'klar-mode-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlarIconComponent],
  template: `
    <div
      class="klar-pop-center fixed left-1/2 z-[60] flex items-center gap-1 px-1 py-1 rounded-full"
      style="
        top: calc(env(safe-area-inset-top, 0) + 6px);
        transform: translateX(-50%);
        background: var(--bg-overlay);
        border: 1px solid var(--line);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      "
      role="toolbar"
      aria-label="Vorschau und Theme"
    >
      <!-- Mode group -->
      <div role="radiogroup" aria-label="Vorschaumodus" class="flex items-center">
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="!isMobilePreview()"
          class="px-2.5 h-7 rounded-full text-[11px] flex items-center gap-1 transition-colors"
          [class.bg-(--bg-3)]="!isMobilePreview()"
          [class.text-(--fg)]="!isMobilePreview()"
          [class.text-(--fg-2)]="isMobilePreview()"
          (click)="setMobile(false)"
          title="Desktop-Vorschau"
        >
          <klar-icon name="trending" [size]="11" /> Desktop
        </button>
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="isMobilePreview()"
          class="px-2.5 h-7 rounded-full text-[11px] flex items-center gap-1 transition-colors"
          [class.bg-(--bg-3)]="isMobilePreview()"
          [class.text-(--fg)]="isMobilePreview()"
          [class.text-(--fg-2)]="!isMobilePreview()"
          (click)="setMobile(true)"
          title="Mobile-Vorschau"
        >
          <klar-icon name="planspiel" [size]="11" /> Mobile
        </button>
      </div>

      <span class="w-px h-4 bg-(--line)" aria-hidden="true"></span>

      <!-- Theme group -->
      <div role="radiogroup" aria-label="Theme" class="flex items-center">
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="resolvedTheme() === 'dark'"
          class="px-2.5 h-7 rounded-full text-[11px] flex items-center gap-1 transition-colors"
          [class.bg-(--bg-3)]="resolvedTheme() === 'dark'"
          [class.text-(--fg)]="resolvedTheme() === 'dark'"
          [class.text-(--fg-2)]="resolvedTheme() !== 'dark'"
          (click)="setTheme('dark')"
          title="Dunkles Theme"
        >
          <klar-icon name="shield" [size]="11" /> Dunkel
        </button>
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="resolvedTheme() === 'light'"
          class="px-2.5 h-7 rounded-full text-[11px] flex items-center gap-1 transition-colors"
          [class.bg-(--bg-3)]="resolvedTheme() === 'light'"
          [class.text-(--fg)]="resolvedTheme() === 'light'"
          [class.text-(--fg-2)]="resolvedTheme() !== 'light'"
          (click)="setTheme('light')"
          title="Helles Theme"
        >
          <klar-icon name="plus" [size]="11" /> Hell
        </button>
      </div>
    </div>
  `,
})
export class KlarModeToolbarComponent {
  private readonly themeService = inject(ThemeService);

  protected readonly isMobilePreview = signal(false);

  protected readonly resolvedTheme = computed<'light' | 'dark'>(() => {
    const t = this.themeService.theme();
    if (t === 'system' && typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return t === 'light' ? 'light' : 'dark';
  });

  @HostBinding('class') readonly hostClass = 'contents';

  protected setMobile(value: boolean): void {
    this.isMobilePreview.set(value);
    const el = document.documentElement;
    el.classList.toggle('mode-mobile-preview', value);
  }

  protected setTheme(theme: 'light' | 'dark'): void {
    this.themeService.set(theme);
  }
}
