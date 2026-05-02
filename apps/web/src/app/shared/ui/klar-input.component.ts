import { Component, input, output, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { HlmInputDirective } from './hlm/hlm-input.directive';
import { HlmLabelDirective } from './hlm/hlm-label.directive';
import { HlmErrorDirective } from './hlm/hlm-error.directive';

@Component({
  selector: 'klar-input',
  standalone: true,
  imports: [KlarIconComponent, HlmInputDirective, HlmLabelDirective, HlmErrorDirective],
  templateUrl: './klar-input.component.html',
  styleUrl: './klar-input.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => KlarInputComponent),
      multi: true,
    },
  ],
})
export class KlarInputComponent implements ControlValueAccessor {
  label       = input<string>();
  type        = input<string>('text');
  placeholder = input<string>('');
  hint        = input<string>();
  error       = input<string>();
  iconName    = input<string>();
  prefix      = input<string>();
  suffix      = input<string>();

  valueChange = output<string>();

  protected value    = '';
  protected isDisabled = false;
  protected inputId  = `klar-input-${Math.random().toString(36).slice(2, 7)}`;

  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string): void            { this.value = v ?? ''; }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.isDisabled = disabled; }

  protected onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.value = val;
    this.onChange(val);
    this.valueChange.emit(val);
  }
}
