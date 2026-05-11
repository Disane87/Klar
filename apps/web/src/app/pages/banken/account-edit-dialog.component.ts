import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { AccountsService } from '../../core/accounts/accounts.service';
import { FintsStore } from '../../core/fints/fints.store';
import { HouseholdStore } from '../../core/household/household.store';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { KlarDialogFooterComponent } from '../../shared/ui/klar-dialog-footer.component';
import { KlarDialogCalloutComponent } from '../../shared/ui/klar-dialog-callout.component';
import { KlarSwitchComponent } from '../../shared/ui/klar-switch.component';

/**
 * Edit dialog for FinTS-attached accounts: rename + toggle inclusion in the
 * sync loop. Only the FinTS-connection owner is authorized API-side; non-
 * owners get a 403 surfaced as a callout.
 */
@Component({
  selector: 'klar-account-edit-dialog',
  standalone: true,
  imports: [
    FormsModule,
    HlmInputDirective,
    HlmLabelDirective,
    KlarSwitchComponent,
    KlarDialogFooterComponent,
    KlarDialogCalloutComponent,
  ],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="account-name">Name</label>
        <input
          id="account-name"
          hlmInput
          type="text"
          maxlength="100"
          placeholder="z.B. Girokonto Hauptbank"
          [value]="name()"
          (input)="name.set($any($event.target).value)"
        />
        @if (name().length > 0 && !nameValid()) {
          <span class="text-[11px] text-(--danger)">1–100 Zeichen.</span>
        }
      </div>

      <div class="flex flex-col gap-1">
        <klar-switch
          [(checked)]="syncEnabled"
          label="Bei Sync einschließen"
          description="Wenn aus, wird dieses Konto bei FinTS-Synchronisationen übersprungen. Bestehende Buchungen bleiben sichtbar."
        />
      </div>

      @if (errorMessage()) {
        <klar-dialog-callout tone="danger" icon="x">
          {{ errorMessage() }}
        </klar-dialog-callout>
      }

      <klar-dialog-footer
        confirmLabel="Speichern"
        [confirmDisabled]="!nameValid() || !dirty()"
        [confirmLoading]="saving()"
        [autoCloseOnCancel]="false"
        (cancel)="onCancel()"
        (confirm)="onSave()"
      />
    </div>
  `,
})
export class AccountEditDialogComponent implements OnInit {
  accountId = input.required<string>();
  initialName = input.required<string>();
  initialSyncEnabled = input.required<boolean>();

  private accounts = inject(AccountsService);
  private fints = inject(FintsStore);
  private household = inject(HouseholdStore);
  private toast = inject(KlarToastService);
  private dialogRef = inject<DialogRef<unknown>>(DialogRef);

  readonly name = signal('');
  readonly syncEnabled = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly nameValid = computed(() => {
    const trimmed = this.name().trim();
    return trimmed.length >= 1 && trimmed.length <= 100;
  });

  readonly dirty = computed(
    () =>
      this.name().trim() !== this.initialName().trim() ||
      this.syncEnabled() !== this.initialSyncEnabled(),
  );

  ngOnInit(): void {
    this.name.set(this.initialName());
    this.syncEnabled.set(this.initialSyncEnabled());
  }

  async onSave(): Promise<void> {
    if (this.saving() || !this.nameValid() || !this.dirty()) return;
    const householdId = this.household.activeId();
    if (!householdId) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const patch: { name?: string; syncEnabled?: boolean } = {};
      const trimmed = this.name().trim();
      if (trimmed !== this.initialName().trim()) patch.name = trimmed;
      if (this.syncEnabled() !== this.initialSyncEnabled()) {
        patch.syncEnabled = this.syncEnabled();
      }
      await firstValueFrom(this.accounts.update(householdId, this.accountId(), patch));
      this.fints.reload();
      this.toast.success('Konto aktualisiert');
      this.dialogRef.close();
    } catch (err: unknown) {
      const msg =
        (err as { error?: { detail?: string } })?.error?.detail ??
        'Speichern fehlgeschlagen';
      this.errorMessage.set(msg);
    } finally {
      this.saving.set(false);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
