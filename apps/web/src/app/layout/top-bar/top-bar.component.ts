import { Component, input, output } from '@angular/core';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';

@Component({
  selector: 'klar-top-bar',
  standalone: true,
  imports: [KlarIconComponent, KlarButtonComponent],
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
