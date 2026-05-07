import { Injectable, signal } from '@angular/core';
import type { ScopeOption } from '../../shared/ui/klar-scope-segment.component';

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
  showExport?:    boolean;
  /** Render the household + members user-switch in the actions row. */
  showUserSwitch?: boolean;
  /**
   * Render a scope-segmented (e.g. Mai 2026 / Schnitt 6M / Jahr).
   * Provide both options + the initial value; consumers read updates
   * via the scopeValue signal exposed on the service.
   */
  scopeSegments?: ScopeOption[];
  scopeValue?:    string;
  addLabel?:      string;
  onAdd?:         () => void;
  onPlanspiel?:   () => void;
  onExport?:      () => void;
  /** Called when the user picks a different scope segment. */
  onScopeChange?: (id: string) => void;
  /** Called when the user picks a different user-switch tab. */
  onUserSwitchChange?: (id: string) => void;
  /** Optional text-only chip rendered in the header actions row (e.g. user email). */
  rhsChip?: string;
}

@Injectable({ providedIn: 'root' })
export class PageHeaderService {
  readonly title          = signal('');
  readonly subtitle       = signal<string | undefined>(undefined);
  readonly showAdd        = signal(false);
  readonly showPlanspiel  = signal(false);
  readonly showExport     = signal(false);
  readonly showUserSwitch = signal(false);
  readonly scopeSegments  = signal<ScopeOption[]>([]);
  readonly scopeValue     = signal<string>('');
  readonly userSwitchValue = signal<string>('all');
  readonly addLabel       = signal('Buchung');
  readonly onAdd          = signal<(() => void) | null>(null);
  readonly onPlanspiel    = signal<(() => void) | null>(null);
  readonly onExport       = signal<(() => void) | null>(null);
  readonly onScopeChange  = signal<((id: string) => void) | null>(null);
  readonly onUserSwitchChange = signal<((id: string) => void) | null>(null);
  readonly stats          = signal<PageStat[]>([]);
  readonly chipLabel      = signal<string | null>(null);
  readonly rhsChip        = signal<string | null>(null);

  set(config: PageHeaderConfig): void {
    this.title.set(config.title);
    this.subtitle.set(config.subtitle);
    this.showAdd.set(config.showAdd ?? false);
    this.showPlanspiel.set(config.showPlanspiel ?? false);
    this.showExport.set(config.showExport ?? false);
    this.showUserSwitch.set(config.showUserSwitch ?? false);
    this.scopeSegments.set(config.scopeSegments ?? []);
    this.scopeValue.set(config.scopeValue ?? '');
    this.userSwitchValue.set('all');
    this.addLabel.set(config.addLabel ?? 'Buchung');
    this.onAdd.set(config.onAdd ?? null);
    this.onPlanspiel.set(config.onPlanspiel ?? null);
    this.onExport.set(config.onExport ?? null);
    this.onScopeChange.set(config.onScopeChange ?? null);
    this.onUserSwitchChange.set(config.onUserSwitchChange ?? null);
    this.stats.set([]);
    this.chipLabel.set(null);
    this.rhsChip.set(config.rhsChip ?? null);
  }
}
