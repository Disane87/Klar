import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'klarMoney', standalone: true, pure: true })
export class KlarMoneyPipe implements PipeTransform {
  private static readonly fmt = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });

  transform(cents: number): string {
    return KlarMoneyPipe.fmt.format(cents / 100);
  }
}
