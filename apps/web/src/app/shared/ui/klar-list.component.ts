import { Component } from '@angular/core';

export { KlarListGroupComponent } from './klar-list-group.component';
export { KlarListItemComponent } from './klar-list-item.component';
export { KlarListRowComponent } from './klar-list-row.component';

@Component({
  selector: 'klar-list',
  standalone: true,
  host: { class: 'block' },
  template: `<ng-content />`,
})
export class KlarListComponent {}
