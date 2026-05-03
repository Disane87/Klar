import { Injectable, signal } from '@angular/core';

export interface PageStat {
  label: string;
  valueCents: number;
  tone: 'surplus' | 'income' | 'expense' | 'neutral';
}

export interface PageHeaderConfig {
  title:          string;
  subtitle?:      string;
  showAdd?:       boolean;
  showPlanspiel?: boolean;
  addLabel?:      string;
  onAdd?:         () => void;
  onPlanspiel?:   () => void;
}

@Injectable({ providedIn: 'root' })
export class PageHeaderService {
  readonly title         = signal('');
  readonly subtitle      = signal<string | undefined>(undefined);
  readonly showAdd       = signal(false);
  readonly showPlanspiel = signal(false);
  readonly addLabel      = signal('Buchung');
  readonly onAdd         = signal<(() => void) | null>(null);
  readonly onPlanspiel   = signal<(() => void) | null>(null);
  readonly stats         = signal<PageStat[]>([]);
  readonly chipLabel     = signal<string | null>(null);

  set(config: PageHeaderConfig): void {
    this.title.set(config.title);
    this.subtitle.set(config.subtitle);
    this.showAdd.set(config.showAdd ?? false);
    this.showPlanspiel.set(config.showPlanspiel ?? false);
    this.addLabel.set(config.addLabel ?? 'Buchung');
    this.onAdd.set(config.onAdd ?? null);
    this.onPlanspiel.set(config.onPlanspiel ?? null);
    this.stats.set([]);
    this.chipLabel.set(null);
  }
}
