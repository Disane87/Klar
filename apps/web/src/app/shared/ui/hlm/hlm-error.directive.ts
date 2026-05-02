import { Directive } from '@angular/core';

@Directive({
  selector: '[hlmError]',
  standalone: true,
  host: { class: 'text-[14px] text-destructive' },
})
export class HlmErrorDirective {}
