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

export interface UserSwitchOption {
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
 * UserSwitch — bundle alerts.jsx pill group with the household + each
 * member as a tab. Klar wires this to the household members + auth user
 * and emits the selected scope (`'all'` or a userId) via the value
 * model so consumers (page-header service, lists) can filter by it.
 */
@Component({
  selector: 'klar-user-switch',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <div class="user-switch" role="tablist" aria-label="Ansicht">
      @for (opt of options(); track opt.id) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="opt.id === value()"
          class="user-switch-pill"
          [class.active]="opt.id === value()"
          [style.--us-tone]="opt.color"
          [title]="opt.sub ? opt.name + ' · ' + opt.sub : opt.name"
          (click)="value.set(opt.id)"
        >
          <span class="user-switch-av" aria-hidden="true">{{ opt.short }}</span>
          <span class="user-switch-label">{{ opt.name }}</span>
        </button>
      }
    </div>
  `,
})
export class KlarUserSwitchComponent {
  private readonly householdStore = inject(HouseholdStore);
  private readonly auth = inject(AuthStore);

  /** The currently-selected scope: `'all'` or a userId. */
  readonly value = model<string>('all');

  /** Optional override of the all-scope label (default: household name). */
  readonly allLabel = input<string>('Haushalt');

  /** CSS color for the household-wide tab avatar (defaults to --accent). */
  readonly allTone = input<string>('var(--accent)');

  /**
   * Cached deterministic palette for member avatars — falls back to
   * the cat-* palette in a stable order.
   */
  private readonly toneFallbacks = signal<string[]>([
    'var(--cat-essen)',
    'var(--cat-freizeit)',
    'var(--cat-versicher)',
    'var(--cat-mobil)',
    'var(--cat-spar)',
    'var(--cat-gesund)',
  ]);

  protected readonly options = computed<UserSwitchOption[]>(() => {
    const members = this.householdStore.members?.() ?? [];
    const fallbacks = this.toneFallbacks();
    const memberOpts: UserSwitchOption[] = members.map((m, idx) => ({
      id: m.userId,
      short: this.shortFor(m.displayName),
      name: m.displayName.split(' ')[0] || m.displayName,
      color: fallbacks[idx % fallbacks.length],
      sub: m.displayName,
    }));
    void this.auth; // wired for future "you" highlight
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
