import { Component } from '@angular/core';
import { KlarWordmarkComponent } from '../brand/klar-wordmark.component';
import { KlarIconComponent } from '../icons/klar-icon.component';

/**
 * Shared two-pane brand sidebar for all auth pages
 * (login / register / verify-email / oauth-consent / onboarding / join / auth-callback).
 *
 * Hidden on mobile (< lg). Renders Fraunces hero + ARGON2ID/100% LOKAL/RS256 chips.
 */
@Component({
  selector: 'klar-auth-brand-pane',
  standalone: true,
  imports: [KlarWordmarkComponent, KlarIconComponent],
  template: `
    <aside
      class="hidden lg:flex flex-col justify-between bg-[var(--bg-1)] border-r border-[var(--line)] px-[var(--s-12)] py-[var(--s-12)] min-h-dvh"
    >
      <klar-wordmark [size]="28" />

      <div class="flex flex-col gap-[var(--s-4)]">
        <span class="eyebrow">Ein Haushalt — keine Wolke</span>
        <h1
          class="m-0 leading-[1.05] tracking-[-0.025em]"
          style="font-family: var(--font-display); font-size: 48px; font-weight: 500;"
        >
          Privatfinanzen,<br />
          <span class="italic font-normal text-[var(--accent)]">klar genug</span> für<br />zwei
          Erwachsene.
        </h1>
        <p class="text-[14px] text-[var(--fg-2)] max-w-[360px] leading-[1.55]">
          Selbstgehostet auf deinem NAS oder Mini-PC. Keine Telemetrie, keine Bank-API, kein
          Algorithmus, der für dich denkt.
        </p>
      </div>

      <div
        class="flex flex-wrap gap-[var(--s-5)] text-[10px] uppercase tracking-[0.14em] text-[var(--fg-2)]"
      >
        <span class="inline-flex items-center gap-1.5">
          <klar-icon name="shield" [size]="12" /> ARGON2ID
        </span>
        <span class="inline-flex items-center gap-1.5">
          <klar-icon name="lock" [size]="12" /> 100% LOKAL
        </span>
        <span class="inline-flex items-center gap-1.5">
          <klar-icon name="key" [size]="12" /> RS256 JWT
        </span>
      </div>
    </aside>
  `,
})
export class KlarAuthBrandPaneComponent {}
