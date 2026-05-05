import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { HlmInputDirective } from '../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../shared/ui/hlm/hlm-label.directive';
import { HlmCheckboxComponent } from '../../shared/ui/hlm/hlm-checkbox.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { HouseholdStore } from '../../core/household/household.store';
import { DataTransferService } from '../../core/data-transfer/data-transfer.service';

@Component({
  selector: 'app-data-export',
  standalone: true,
  imports: [
    FormsModule,
    KlarButtonComponent,
    HlmInputDirective,
    HlmLabelDirective,
    HlmCheckboxComponent,
  ],
  templateUrl: './data-export.component.html',
})
export class DataExportComponent {
  private dtService = inject(DataTransferService);
  private hhStore = inject(HouseholdStore);
  private toast = inject(KlarToastService);
  readonly dialog = inject(KlarDialogService);

  readonly includeTransactions = signal(true);
  readonly includeRecurring = signal(true);
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly exporting = signal(false);

  async export(): Promise<void> {
    const parts: string[] = [];
    if (this.includeTransactions()) parts.push('transactions');
    if (this.includeRecurring()) parts.push('recurringTransactions');
    if (!parts.length) {
      this.toast.error('Wähle mindestens eine Datenquelle aus');
      return;
    }

    this.exporting.set(true);
    try {
      await this.dtService.export(this.hhStore.activeId()!, {
        include: parts.join(','),
        startDate: this.startDate() || undefined,
        endDate: this.endDate() || undefined,
      });
      this.toast.success('Export gestartet');
      this.dialog.close();
    } catch {
      // ErrorInterceptor handles the HTTP error toast
    } finally {
      this.exporting.set(false);
    }
  }
}
