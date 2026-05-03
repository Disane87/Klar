import { Component, inject } from '@angular/core';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { PageHeaderService } from '../../core/page-header/page-header.service';

@Component({
  selector: 'app-tresor',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [KlarIconComponent],
  templateUrl: './tresor.component.html',
  styleUrl: './tresor.component.css',
})
export class TresorPageComponent {
  constructor() {
    inject(PageHeaderService).set({
      title:    'Tresor',
      subtitle: 'ERSPARNISSE & RÜCKLAGEN',
    });
  }
}