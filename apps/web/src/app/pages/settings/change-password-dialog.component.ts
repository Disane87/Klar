import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarDialogFooterComponent } from '../../shared/ui/klar-dialog-footer.component';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { UserSettingsStore } from '../../core/user/user-settings.store';

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [FormsModule, HlmInputDirective, HlmLabelDirective, KlarDialogFooterComponent],
  templateUrl: './change-password-dialog.component.html',
})
export class ChangePasswordDialogComponent {
  private store = inject(UserSettingsStore);
  readonly dialog = inject(KlarDialogService);
  private toast = inject(KlarToastService);

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly saving = signal(false);
  readonly error = signal('');

  readonly canSubmit = () =>
    this.currentPassword().length > 0 &&
    this.newPassword().length >= 8 &&
    this.newPassword() === this.confirmPassword();

  async submit(): Promise<void> {
    this.error.set('');
    if (!this.canSubmit()) return;
    this.saving.set(true);
    try {
      await this.store.changePassword(this.currentPassword(), this.newPassword());
      this.toast.success('Passwort geändert');
      this.dialog.close();
    } catch {
      this.error.set('Aktuelles Passwort falsch oder Server-Fehler.');
    } finally {
      this.saving.set(false);
    }
  }
}
