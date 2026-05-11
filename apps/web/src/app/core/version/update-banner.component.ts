import { Component, inject } from '@angular/core';
import { VersionService } from './version.service';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'klar-update-banner',
  standalone: true,
  imports: [KlarIconComponent, RouterLink],
  template: `
    @if (version.showUpdateBanner()) {
      <div class="flex items-center justify-between gap-3 px-4 py-2 max-md:pt-[calc(0.5rem+var(--safe-top))] bg-accent/10 border-b border-accent/20 text-sm shrink-0">
        <div class="flex items-center gap-2 text-accent">
          <klar-icon name="arrow-up" [size]="14" [stroke]="2" />
          <span class="font-medium">
            Neue Version verfügbar: {{ version.latestVersion() }}
          </span>
        </div>
        <div class="flex items-center gap-3">
          <a
            routerLink="/app/health"
            class="text-accent font-medium underline underline-offset-2 decoration-dotted text-xs"
          >
            Was ist neu?
          </a>
          <button
            (click)="version.dismiss()"
            class="text-(--text-muted) hover:text-(--text) transition-colors min-h-6 min-w-6 flex items-center justify-center"
            aria-label="Schließen"
          >
            <klar-icon name="x" [size]="14" [stroke]="2" />
          </button>
        </div>
      </div>
    }
  `,
})
export class UpdateBannerComponent {
  protected version = inject(VersionService);
}
