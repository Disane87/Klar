import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { PayrollCalculatorState } from '@klar/shared';

const BASE = '/api/v1/users/me/payroll-calculator-state';

@Injectable({ providedIn: 'root' })
export class PayrollCalculatorStateService {
  private readonly http = inject(HttpClient);

  load(): Promise<PayrollCalculatorState | null> {
    return firstValueFrom(this.http.get<PayrollCalculatorState | null>(BASE));
  }

  save(state: PayrollCalculatorState): Promise<PayrollCalculatorState> {
    return firstValueFrom(this.http.patch<PayrollCalculatorState>(BASE, state));
  }
}
