import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface CategoryMappingItem {
  source: { name: string; type: string };
  resolvedId: string | null;
}

export interface ProjectMappingItem {
  source: { name: string };
  resolvedId: string | null;
}

export interface AnalyzeResponse {
  summary: { transactions: number; recurringTransactions: number };
  categoryMappings: CategoryMappingItem[];
  projectMappings: ProjectMappingItem[];
  availableCategories: { id: string; name: string; type: string }[];
  availableProjects: { id: string; name: string }[];
}

export interface ConfirmBody {
  fileContent: string;
  categoryMappings: { sourceName: string; sourceType: string; targetId: string }[];
  projectMappings: { sourceName: string; targetId: string }[];
}

export interface ImportResult {
  imported: { transactions: number; recurringTransactions: number };
  skipped: number;
}

export interface ExportParams {
  include?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable({ providedIn: 'root' })
export class DataTransferService {
  private http = inject(HttpClient);

  private base(householdId: string): string {
    return `/api/v1/households/${householdId}`;
  }

  async export(householdId: string, params: ExportParams = {}): Promise<void> {
    const httpParams: Record<string, string> = {};
    if (params.include) httpParams['include'] = params.include;
    if (params.startDate) httpParams['startDate'] = params.startDate;
    if (params.endDate) httpParams['endDate'] = params.endDate;

    const response = await firstValueFrom(
      this.http.get(`${this.base(householdId)}/export`, {
        params: httpParams,
        responseType: 'blob',
        observe: 'response',
      }),
    );

    const blob = response.body!;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `klar-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  analyze(householdId: string, fileContent: string): Promise<AnalyzeResponse> {
    return firstValueFrom(
      this.http.post<AnalyzeResponse>(
        `${this.base(householdId)}/import/analyze`,
        { fileContent },
      ),
    );
  }

  confirm(householdId: string, body: ConfirmBody): Promise<ImportResult> {
    return firstValueFrom(
      this.http.post<ImportResult>(
        `${this.base(householdId)}/import/confirm`,
        body,
      ),
    );
  }
}
