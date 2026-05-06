import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HouseholdStore } from '../household/household.store';
import { CategoriesStore } from '../categories/categories.store';
import { TransactionsStore } from '../transactions/transactions.store';
import { OverviewStore } from '../overview/overview.store';
import type {
  AnalyzeResponse,
  ConfirmResponse,
  ConfirmRowSelection,
} from './csv-import.types';

@Injectable({ providedIn: 'root' })
export class CsvImportService {
  private http = inject(HttpClient);
  private household = inject(HouseholdStore);
  private categories = inject(CategoriesStore);
  private transactions = inject(TransactionsStore);
  private overview = inject(OverviewStore);

  private base(): string {
    const id = this.household.activeId();
    if (!id) throw new Error('Kein aktiver Haushalt');
    return `/api/v1/households/${id}/csv-import`;
  }

  async fileToBase64(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + chunkSize)),
      );
    }
    return btoa(binary);
  }

  analyze(fileBase64: string): Promise<AnalyzeResponse> {
    return firstValueFrom(
      this.http.post<AnalyzeResponse>(`${this.base()}/analyze`, { fileBase64 }),
    );
  }

  async confirm(
    fileBase64: string,
    filename: string,
    rows: ConfirmRowSelection[],
  ): Promise<ConfirmResponse> {
    const result = await firstValueFrom(
      this.http.post<ConfirmResponse>(`${this.base()}/confirm`, {
        fileBase64,
        filename,
        rows,
      }),
    );
    this.transactions.reload();
    this.categories.reload();
    this.overview.reload();
    return result;
  }
}
