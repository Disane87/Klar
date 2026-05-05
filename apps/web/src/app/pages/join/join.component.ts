import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { KlarWordmarkComponent } from '../../shared/brand/klar-wordmark.component';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { AuthStore } from '../../core/auth/auth.store';
import { HouseholdStore } from '../../core/household/household.store';
import { HouseholdService } from '../../core/household/household.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';

export const PENDING_INVITE_KEY = 'pendingInviteToken';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [RouterLink, KlarWordmarkComponent, HlmButtonDirective, HlmSpinnerComponent, KlarIconComponent],
  template: `
    <div class="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-4 py-12 pt-[calc(3rem+var(--safe-top))]">
      <div class="w-full max-w-sm flex flex-col items-center gap-8">
        <klar-wordmark />

        @if (loading()) {
          <div class="flex flex-col items-center gap-4">
            <hlm-spinner />
            <p class="text-sm text-muted-foreground">Einladung wird geprüft…</p>
          </div>
        } @else if (error()) {
          <div class="w-full rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center">
            <klar-icon name="alert-circle" [size]="40" class="text-destructive mx-auto mb-3 block" />
            <p class="text-sm font-medium text-foreground">Einladung nicht verfügbar</p>
            <p class="text-xs text-muted-foreground mt-1">{{ error() }}</p>
            <a hlmBtn variant="outline" class="mt-4 w-full min-h-[44px]" routerLink="/login">Zur Anmeldung</a>
          </div>
        } @else if (joined()) {
          <div class="w-full rounded-xl border border-success/40 bg-success/10 p-6 text-center">
            <klar-icon name="check-circle" [size]="40" class="text-success mx-auto mb-3 block" />
            <p class="text-sm font-medium text-foreground">Haushalt beigetreten!</p>
            <p class="text-xs text-muted-foreground mt-1">Du bist jetzt Mitglied von <strong>{{ householdName() }}</strong></p>
            <button hlmBtn variant="default" class="mt-4 w-full min-h-[44px]" (click)="goToApp()">Zur App</button>
          </div>
        } @else {
          <div class="w-full rounded-xl border border-border bg-card p-6 text-center">
            <klar-icon name="home" [size]="40" class="text-primary mx-auto mb-3 block" />
            <p class="text-base font-semibold text-foreground">Einladung zu <strong>{{ householdName() }}</strong></p>
            @if (expiresAt()) {
              <p class="text-xs text-muted-foreground mt-1">Gültig bis {{ formatDate(expiresAt()!) }}</p>
            }

            @if (isLoggedIn()) {
              <button hlmBtn variant="default" class="mt-6 w-full min-h-[44px]" [disabled]="joining()" (click)="join()">
                @if (joining()) { <hlm-spinner size="sm" class="mr-2" /> }
                Haushalt beitreten
              </button>
            } @else {
              <p class="text-sm text-muted-foreground mt-4">Melde dich an oder registriere dich, um beizutreten.</p>
              <div class="flex flex-col gap-2 mt-4">
                <a hlmBtn variant="default" class="w-full min-h-[44px]" [routerLink]="['/register']" [queryParams]="{ invite: token() }">
                  Registrieren &amp; beitreten
                </a>
                <a hlmBtn variant="outline" class="w-full min-h-[44px]" [routerLink]="['/login']" [queryParams]="{ invite: token() }">
                  Anmelden &amp; beitreten
                </a>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class JoinComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authStore = inject(AuthStore);
  private householdStore = inject(HouseholdStore);
  private householdService = inject(HouseholdService);
  private toast = inject(KlarToastService);

  readonly token = signal('');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly householdName = signal('');
  readonly expiresAt = signal<string | null>(null);
  readonly joining = signal(false);
  readonly joined = signal(false);
  readonly isLoggedIn = this.authStore.isAuthenticated;

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    this.token.set(token);

    // If logged in, try auto-join from sessionStorage pending token
    const pending = sessionStorage.getItem(PENDING_INVITE_KEY);
    if (pending && this.authStore.isAuthenticated()) {
      sessionStorage.removeItem(PENDING_INVITE_KEY);
      await this.doJoin(pending);
      return;
    }

    try {
      const info = await this.householdService.getInviteInfo(token);
      this.householdName.set(info.householdName);
      this.expiresAt.set(info.expiresAt);

      // Smart redirect: if invite has a specific email, route to login or register automatically
      if (info.email && !this.authStore.isAuthenticated()) {
        sessionStorage.setItem(PENDING_INVITE_KEY, token);
        if (info.userExists) {
          await this.router.navigate(['/login'], { queryParams: { email: info.email } });
        } else {
          await this.router.navigate(['/register'], { queryParams: { email: info.email } });
        }
        return;
      }
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 410) this.error.set('Dieser Einladungslink wurde bereits verwendet oder ist abgelaufen.');
      else if (status === 404) this.error.set('Dieser Einladungslink existiert nicht.');
      else this.error.set('Einladungslink konnte nicht geladen werden.');
    } finally {
      this.loading.set(false);
    }
  }

  async join(): Promise<void> {
    await this.doJoin(this.token());
  }

  private async doJoin(token: string): Promise<void> {
    this.joining.set(true);
    try {
      await this.householdService.joinByToken(token);
      await this.householdStore.loadHouseholds();
      this.joined.set(true);
      this.loading.set(false);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      if (status === 410) this.error.set('Dieser Einladungslink wurde bereits verwendet oder ist abgelaufen.');
      else if (status === 400) this.error.set(detail ?? 'Du bist bereits Mitglied dieses Haushalts.');
      else this.error.set('Beitreten fehlgeschlagen. Bitte versuche es erneut.');
      this.loading.set(false);
    } finally {
      this.joining.set(false);
    }
  }

  goToApp(): void {
    const firstHousehold = this.householdStore.households()[0];
    if (firstHousehold) {
      this.householdStore.setActiveHousehold(firstHousehold.household.id);
    }
    void this.router.navigate(['/app']);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
