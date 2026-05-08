import { Component, inject, OnInit, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { KlarDialogFooterComponent } from '../../shared/ui/klar-dialog-footer.component';
import { HouseholdStore } from '../../core/household/household.store';
import { KlarToastService } from '../../shared/ui/klar-toast.service';

@Component({
  selector: 'app-household-rename-dialog',
  standalone: true,
  imports: [HlmInputDirective, HlmLabelDirective, KlarDialogFooterComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <label hlmLabel for="hh-rename">Name</label>
        <input id="hh-rename" hlmInput type="text"
               placeholder="Haushaltsname"
               [value]="name()"
               (input)="name.set($any($event.target).value)" />
      </div>

      <klar-dialog-footer
        confirmLabel="Speichern"
        [confirmDisabled]="!name().trim() || name().trim() === initial()"
        [confirmLoading]="saving()"
        [autoCloseOnCancel]="false"
        (cancel)="onCancel()"
        (confirm)="onSave()" />
    </div>
  `,
})
export class HouseholdRenameDialogComponent implements OnInit {
  private store = inject(HouseholdStore);
  private toast = inject(KlarToastService);
  private ref   = inject<DialogRef<unknown>>(DialogRef);

  readonly name    = signal('');
  readonly initial = signal('');
  readonly saving  = signal(false);

  ngOnInit(): void {
    const current = this.store.activeName();
    this.name.set(current);
    this.initial.set(current);
  }

  onCancel(): void { this.ref.close(); }

  async onSave(): Promise<void> {
    const next = this.name().trim();
    if (!next || next === this.initial() || this.saving()) return;
    this.saving.set(true);
    try {
      await this.store.rename(next);
      this.toast.success('Name gespeichert');
      this.ref.close();
    } catch {
      this.toast.error('Name konnte nicht gespeichert werden');
    } finally {
      this.saving.set(false);
    }
  }
}
