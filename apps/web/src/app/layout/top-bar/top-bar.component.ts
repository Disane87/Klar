import { Component, input, output } from '@angular/core';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarMonthChipComponent } from '../../shared/ui/klar-month-chip.component';
import { KlarHeaderUserComponent } from '../../shared/ui/klar-header-user.component';

@Component({
  selector: 'klar-top-bar',
  standalone: true,
  host: { class: 'block w-full' },
  imports: [KlarMonthChipComponent, KlarIconComponent, HlmButtonDirective, KlarHeaderUserComponent],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.css',
})
export class TopBarComponent {
  title         = input('');
  subtitle      = input<string>();
  monthChip     = input('April 2026');
  showPlanspiel = input(false);
  showAdd       = input(false);
  addLabel      = input('Buchung');

  addClick       = output<void>();
  planspielClick = output<void>();
}
