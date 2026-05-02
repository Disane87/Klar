import { Component, input } from '@angular/core';
import { HlmLabelDirective } from './hlm/hlm-label.directive';
import { HlmErrorDirective } from './hlm/hlm-error.directive';

@Component({
  selector: 'klar-form-field',
  standalone: true,
  imports: [HlmLabelDirective, HlmErrorDirective],
  template: `
    <div class="flex flex-col gap-1.5">
      @if (label()) {
        <label hlmLabel [attr.for]="for()">{{ label() }}</label>
      }
      <ng-content />
      @if (error()) {
        <span hlmError>{{ error() }}</span>
      }
    </div>
  `,
})
export class KlarFormFieldComponent {
  label = input('');
  for   = input('');
  error = input('');
}
