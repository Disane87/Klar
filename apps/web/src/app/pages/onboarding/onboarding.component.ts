import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { KlarWordmarkComponent } from '../../shared/brand/klar-wordmark.component';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarInputComponent } from '../../shared/ui/klar-input.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarActionTileComponent } from '../../shared/ui/klar-action-tile.component';
import { HouseholdStore } from '../../core/household/household.store';
import { HouseholdService } from '../../core/household/household.service';
import { AuthStore } from '../../core/auth/auth.store';

type Mode = 'choose' | 'create' | 'join';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [
    FormsModule,
    KlarWordmarkComponent,
    KlarButtonComponent,
    KlarInputComponent,
    KlarIconComponent,
    KlarActionTileComponent,
  ],
  host: { class: 'block' },
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.css',
})
export class OnboardingComponent {
  private householdStore = inject(HouseholdStore);
  private householdService = inject(HouseholdService);
  private authStore = inject(AuthStore);
  private router = inject(Router);

  readonly mode = signal<Mode>('choose');
  readonly householdName = signal('Mein Haushalt');
  readonly inviteCode = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);

  readonly nameError = computed(() => {
    const v = this.householdName().trim();
    if (!v) return 'Pflichtfeld';
    return null;
  });

  readonly codeError = computed(() => {
    const v = this.inviteCode().trim();
    if (!v) return 'Pflichtfeld';
    return null;
  });

  setMode(m: Mode): void {
    this.mode.set(m);
    this.error.set(null);
    this.submitted.set(false);
  }

  async createHousehold(): Promise<void> {
    this.submitted.set(true);
    if (this.nameError() || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);
    try {
      const user = this.authStore.user();
      if (!user) return;
      // POST directly to create (register creates one automatically, but user may have deleted it)
      // For now use join flow — household already created on register
      await this.householdStore.loadHouseholds();
      await this.router.navigate(['/app']);
    } catch {
      this.error.set('Haushalt konnte nicht erstellt werden.');
    } finally {
      this.loading.set(false);
    }
  }

  async joinHousehold(): Promise<void> {
    this.submitted.set(true);
    if (this.codeError() || this.loading()) return;
    // Redirect to the join page — the token is the invitation link token
    await this.router.navigate(['/join', this.inviteCode().trim()]);
  }

  async logout(): Promise<void> {
    await this.authStore.logout();
  }
}
