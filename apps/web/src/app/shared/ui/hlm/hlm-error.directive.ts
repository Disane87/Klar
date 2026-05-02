import { Directive } from '@angular/core';

@Directive({
  selector: '[hlmError]',
  standalone: true,
  host: { class: 'text-[11px] text-destructive' },
})
export class HlmErrorDirective {}
