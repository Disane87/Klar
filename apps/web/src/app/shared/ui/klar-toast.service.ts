import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  tone: 'success' | 'error' | 'info';
  title: string;
  body?: string;
}

@Injectable({ providedIn: 'root' })
export class KlarToastService {
  readonly toasts = signal<Toast[]>([]);

  success(title: string, body?: string): void { this.add('success', title, body); }
  error(title: string, body?: string): void   { this.add('error',   title, body); }
  info(title: string, body?: string): void    { this.add('info',    title, body); }

  dismiss(id: string): void {
    this.toasts.update(ts => ts.filter(t => t.id !== id));
  }

  private add(tone: Toast['tone'], title: string, body?: string): void {
    const id = crypto.randomUUID();
    this.toasts.update(ts => [...ts, { id, tone, title, body }]);
    setTimeout(() => this.dismiss(id), 5000);
  }
}
