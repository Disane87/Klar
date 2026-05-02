import { Component, input, output } from '@angular/core';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';

@Component({
  selector: 'klar-top-bar',
  standalone: true,
  imports: [KlarIconComponent, HlmButtonDirective],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.css',
})
export class TopBarComponent {
  title         = input('');
  subtitle      = input<string>();
  monthChip     = input('April 2026');
  showPlanspiel = input(true);
  showAdd       = input(true);
  addLabel      = input('Buchung');

  addClick        = output<void>();
  planspielClick  = output<void>();
}
