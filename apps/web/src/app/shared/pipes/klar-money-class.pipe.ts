import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'klarMoneyClass', standalone: true, pure: true })
export class KlarMoneyClassPipe implements PipeTransform {
  transform(cents: number): string {
    if (cents > 0) return 'text-success';
    if (cents < 0) return 'text-danger';
    return 'text-muted-foreground';
  }
}
