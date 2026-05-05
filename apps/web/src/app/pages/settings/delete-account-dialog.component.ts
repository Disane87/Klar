import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { UserSettingsStore } from '../../core/user/user-settings.store';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-delete-account-dialog',
  standalone: true,
  imports: [FormsModule, KlarButtonComponent, HlmInputDirective, HlmLabelDirective],
  templateUrl: './delete-account-dialog.component.html',
})
export class DeleteAccountDialogComponent {
  private store = inject(UserSettingsStore);
  private authStore = inject(AuthStore);
  readonly dialog = inject(KlarDialogService);

  readonly confirmEmail = signal('');
  readonly deleting = signal(false);
  readonly error = signal('');

  readonly userEmail = () => this.authStore.user()?.email ?? '';
  readonly canDelete = () =>
    this.confirmEmail().toLowerCase() === this.userEmail().toLowerCase();

  async confirm(): Promise<void> {
    if (!this.canDelete()) return;
    this.deleting.set(true);
    this.error.set('');
    try {
      await this.store.deleteAccount();
      // UserSettingsStore.deleteAccount() calls AuthStore.logout() which navigates away
    } catch (err: unknown) {
      const msg = (err as { error?: { detail?: string } }).error?.detail;
      this.error.set(msg ?? 'Konto konnte nicht gelöscht werden.');
      this.deleting.set(false);
    }
  }
}
