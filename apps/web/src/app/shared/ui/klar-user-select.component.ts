import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { HouseholdStore } from '../../core/household/household.store';
import { AuthStore } from '../../core/auth/auth.store';

export interface UserSelectOption {
  /** 'all' for the household-wide tab, otherwise the userId. */
  id: string;
  /** Two-letter avatar short, e.g. 'WG' / 'M' / 'L'. */
  short: string;
  /** Full label rendered next to the avatar. */
  name: string;
  /** CSS color used for the avatar circle (--us-tone). */
  color: string;
  /** Optional subtitle for the title attribute. */
  sub?: string;
}

/**
 * Canonical Klar user-scope selector — pill group of household-wide
 * ("WG") + each member. Single visual across the whole app: every page
 * that scopes data per member uses this exact component (Fixkosten,
 * Kalender, Buchungen, Banken, …). Emits `'all'` or a userId via
 * `value` so consumers can filter.
 */
@Component({
  selector: 'klar-user-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <div class="user-select" role="tablist" aria-label="Ansicht">
      @for (opt of options(); track opt.id) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="opt.id === value()"
          class="user-select-pill"
          [class.active]="opt.id === value()"
          [style.--us-tone]="opt.color"
          [title]="opt.sub ? opt.name + ' · ' + opt.sub : opt.name"
          (click)="value.set(opt.id)"
        >
          <span class="user-select-av" aria-hidden="true">{{ opt.short }}</span>
          <span class="user-select-label">{{ opt.name }}</span>
        </button>
      }
    </div>
  `,
})
export class KlarUserSelectComponent {
  private readonly householdStore = inject(HouseholdStore);
  private readonly auth = inject(AuthStore);

  /** The currently-selected scope: `'all'` or a userId. */
  readonly value = model<string>('all');

  /** Optional override of the all-scope label (default: household name). */
  readonly allLabel = input<string>('Haushalt');

  /** CSS color for the household-wide tab avatar (defaults to --accent). */
  readonly allTone = input<string>('var(--accent)');

  private readonly toneFallbacks = signal<string[]>([
    'var(--cat-essen)',
    'var(--cat-freizeit)',
    'var(--cat-versicher)',
    'var(--cat-mobil)',
    'var(--cat-spar)',
    'var(--cat-gesund)',
  ]);

  protected readonly options = computed<UserSelectOption[]>(() => {
    const members = this.householdStore.members?.() ?? [];
    const fallbacks = this.toneFallbacks();
    const memberOpts: UserSelectOption[] = members.map((m, idx) => ({
      id: m.userId,
      short: this.shortFor(m.displayName),
      name: m.displayName.split(' ')[0] || m.displayName,
      color: fallbacks[idx % fallbacks.length],
      sub: m.displayName,
    }));
    void this.auth;
    return [
      {
        id: 'all',
        short: 'WG',
        name: this.allLabel(),
        color: this.allTone(),
      },
      ...memberOpts,
    ];
  });

  private shortFor(name: string): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '–';
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
}
