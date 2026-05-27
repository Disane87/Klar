import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TRIGGER_FIELDS,
  type ComparisonOperator,
  type DigestMode,
  type NotificationChannel,
  type NotificationTrigger,
  type Predicate,
} from '@klar/shared';
import { KlarButtonComponent } from '../../../shared/ui/klar-button.component';
import { KlarIconComponent } from '../../../shared/icons/klar-icon.component';
import { KlarDialogService } from '../../../shared/ui/klar-dialog.service';
import { KlarDialogCalloutComponent } from '../../../shared/ui/klar-dialog-callout.component';
import { KlarSelectComponent, type KlarSelectOption } from '../../../shared/ui/klar-select.component';
import {
  NotificationRulesStore,
} from '../../../core/notification-rules/notification-rules.store';
import type {
  CreateNotificationRuleInput,
  NotificationRuleDto,
} from '../../../core/notification-rules/notification-rules.service';

interface ConditionRow {
  field: string;
  operator: ComparisonOperator;
  value: string;
}

/**
 * Parse user-typed numbers tolerantly. Accepts both German (1.000,50) and
 * English (1000.50) notation. Strips thousands separators before parsing.
 */
function parseLocaleNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let normalised = trimmed;
  if (trimmed.includes(',')) {
    normalised = trimmed.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}

/**
 * Phase 2 rule builder: single AND-group of cmp rows, no nested or/not.
 * The full recursive builder lands with Phase 7. This shape covers the
 * integration-test target ("amountCents > X AND categoryId = Y") and is
 * forward-compatible — saved predicates are valid Predicate ASTs.
 */
@Component({
  selector: 'klar-notification-rule-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    KlarButtonComponent,
    KlarIconComponent,
    KlarSelectComponent,
    KlarDialogCalloutComponent,
  ],
  template: `
    <div class="flex flex-col gap-(--s-4)">
      @if (errorMessage()) {
        <klar-dialog-callout tone="danger" icon="x">
          {{ errorMessage() }}
        </klar-dialog-callout>
      }

      <label class="flex flex-col gap-1">
        <span class="text-[11px] uppercase tracking-widest text-(--fg-2)">Name</span>
        <input
          class="hlm-input"
          type="text"
          [(ngModel)]="name"
          name="rule-name"
          placeholder="z. B. Gehalt eingegangen"
          maxlength="120"
        />
      </label>

      <div class="flex flex-col gap-1">
        <span class="text-[11px] uppercase tracking-widest text-(--fg-2)">Auslöser</span>
        <klar-select
          [options]="triggerOptions"
          [(value)]="trigger"
          ariaLabel="Auslöser"
        />
        <span class="text-[11px] text-(--fg-3)">
          Phase 2: nur Buchung-Erstellung. Weitere Auslöser kommen später.
        </span>
      </div>

      <fieldset class="flex flex-col gap-2 border border-(--line-soft) rounded-md p-3">
        <legend class="text-[11px] uppercase tracking-widest text-(--fg-2) px-1">
          Bedingungen (alle müssen zutreffen)
        </legend>
        @for (row of conditions(); track $index; let i = $index) {
          <div class="flex flex-wrap items-center gap-2">
            <klar-select
              [options]="fieldOptions()"
              [value]="row.field"
              (valueChange)="updateRow(i, 'field', $event)"
              ariaLabel="Feld"
            />
            <klar-select
              [options]="operatorOptionsFor(row.field)"
              [value]="row.operator"
              (valueChange)="updateRow(i, 'operator', $event)"
              ariaLabel="Operator"
            />
            <div class="flex-1 min-w-[140px] flex items-center gap-1">
              <input
                class="hlm-input flex-1"
                type="text"
                [ngModel]="row.value"
                (ngModelChange)="updateRow(i, 'value', $event)"
                [name]="'cond-' + i"
                [placeholder]="placeholderFor(row.field)"
              />
              @if (isMoneyField(row.field)) {
                <span class="text-[12px] text-(--fg-3) mono">€</span>
              }
            </div>
            <button
              type="button"
              class="text-(--fg-3) hover:text-(--danger) p-1"
              [attr.aria-label]="'Bedingung entfernen'"
              (click)="removeRow(i)"
            >
              <klar-icon name="x" [size]="12" />
            </button>
          </div>
        }
        <button
          type="button"
          class="self-start text-[12px] text-(--accent) hover:opacity-80 px-1"
          (click)="addRow()"
        >
          + Bedingung
        </button>
      </fieldset>

      <div class="flex flex-col gap-2">
        <span class="text-[11px] uppercase tracking-widest text-(--fg-2)">Kanäle</span>
        <label class="flex items-center gap-2 text-[13px]">
          <input type="checkbox" [(ngModel)]="ch_inApp" name="ch-in-app" />
          Inbox (immer empfohlen)
        </label>
        <label class="flex items-center gap-2 text-[13px]">
          <input type="checkbox" [(ngModel)]="ch_webPush" name="ch-web-push" />
          Web-Push (OS-Benachrichtigung) — Geräte unter Einstellungen aktivieren
        </label>
        <label class="flex items-center gap-2 text-[13px]">
          <input type="checkbox" [(ngModel)]="ch_email" name="ch-email" />
          E-Mail
        </label>
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-[11px] uppercase tracking-widest text-(--fg-2)">Häufigkeit</span>
        <klar-select
          [options]="digestOptions"
          [(value)]="digestMode"
          ariaLabel="Häufigkeit"
        />
        <span class="text-[11px] text-(--fg-3)">
          Inbox kommt immer sofort. Push/E-Mail werden gesammelt, wenn du
          stündliche oder tägliche Zusammenfassung wählst.
        </span>
      </div>

      <div class="flex items-center justify-between gap-3 pt-2 border-t border-(--line-soft)">
        <span class="text-[11px] text-(--fg-3)">
          Idempotent — jede Buchung löst eine Regel höchstens einmal aus.
        </span>
        <div class="flex items-center gap-2">
          <klar-button tone="ghost" size="sm" (click)="cancel()">Abbrechen</klar-button>
          <klar-button
            tone="primary"
            size="sm"
            [disabled]="!canSave() || saving()"
            (click)="save()"
          >
            {{ saving() ? 'Speichere …' : (existing() ? 'Speichern' : 'Anlegen') }}
          </klar-button>
        </div>
      </div>
    </div>
  `,
})
export class NotificationRuleDialogComponent {
  readonly existing = input<NotificationRuleDto | null>(null);

  private readonly store = inject(NotificationRulesStore);
  private readonly dialog = inject(KlarDialogService);

  protected readonly name = signal('');
  protected readonly trigger = signal<NotificationTrigger>('TRANSACTION_CREATED');
  protected readonly conditions = signal<ConditionRow[]>([
    // amountCents is a money field — UI accepts Euro and converts to cents on save.
    { field: 'amountCents', operator: '>', value: '1000' },
  ]);
  protected readonly ch_inApp = signal(true);
  protected readonly ch_webPush = signal(false);
  protected readonly ch_email = signal(false);
  protected readonly digestMode = signal<DigestMode>('IMMEDIATE');
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly triggerOptions: KlarSelectOption[] = [
    { value: 'TRANSACTION_CREATED', label: 'Buchung erstellt' },
    { value: 'STANDING_ORDER_DUE', label: 'Dauerauftrag fällig' },
    { value: 'BUDGET_THRESHOLD', label: 'Budget-Schwelle' },
    { value: 'FINTS_SYNC_EVENT', label: 'FinTS-Sync-Ereignis' },
  ];

  protected readonly digestOptions: KlarSelectOption[] = [
    { value: 'IMMEDIATE', label: 'Sofort' },
    { value: 'HOURLY', label: 'Stündliche Zusammenfassung' },
    { value: 'DAILY', label: 'Tägliche Zusammenfassung' },
  ];

  protected readonly fieldOptions = computed<KlarSelectOption[]>(() =>
    TRIGGER_FIELDS[this.trigger()].map(f => ({ value: f.field, label: f.label })),
  );

  protected readonly canSave = computed(() => {
    if (!this.name().trim()) return false;
    if (this.conditions().length === 0) return false;
    if (this.conditions().some(c => !c.value && c.field !== 'isIncome')) return false;
    if (!this.ch_inApp() && !this.ch_webPush() && !this.ch_email()) return false;
    return true;
  });

  constructor() {
    queueMicrotask(() => this.hydrateFromExisting());
  }

  private hydrateFromExisting(): void {
    const e = this.existing();
    if (!e) return;
    this.name.set(e.name);
    this.trigger.set(e.trigger);
    this.ch_inApp.set(e.channels.includes('IN_APP'));
    this.ch_webPush.set(e.channels.includes('WEB_PUSH'));
    this.ch_email.set(e.channels.includes('EMAIL'));
    this.digestMode.set(e.digestMode);
    this.conditions.set(this.predicateToRows(e.predicate));
  }

  protected operatorOptionsFor(field: string): KlarSelectOption[] {
    const spec = TRIGGER_FIELDS[this.trigger()].find(f => f.field === field);
    if (!spec) return [];
    return spec.operators.map(op => ({ value: op, label: this.operatorLabel(op) }));
  }

  protected isMoneyField(field: string): boolean {
    return TRIGGER_FIELDS[this.trigger()].find(f => f.field === field)?.kind === 'money';
  }

  protected placeholderFor(field: string): string {
    const spec = TRIGGER_FIELDS[this.trigger()].find(f => f.field === field);
    if (!spec) return 'Wert';
    if (spec.kind === 'money') return 'Euro (z. B. 1000 oder 999,50)';
    if (spec.kind === 'boolean') return 'true / false';
    if (spec.kind === 'id') return 'ID';
    if (spec.kind === 'date') return 'YYYY-MM-DD';
    return 'Wert';
  }

  protected addRow(): void {
    this.conditions.update(rows => [
      ...rows,
      { field: 'amountCents', operator: '>', value: '0' },
    ]);
  }

  protected removeRow(i: number): void {
    this.conditions.update(rows => rows.filter((_, idx) => idx !== i));
  }

  protected updateRow(i: number, key: keyof ConditionRow, value: string): void {
    this.conditions.update(rows =>
      rows.map((row, idx) =>
        idx === i ? { ...row, [key]: value as never } : row,
      ),
    );
  }

  protected cancel(): void {
    this.dialog.close();
  }

  protected async save(): Promise<void> {
    this.errorMessage.set(null);
    this.saving.set(true);
    try {
      const channels: NotificationChannel[] = [];
      if (this.ch_inApp()) channels.push('IN_APP');
      if (this.ch_webPush()) channels.push('WEB_PUSH');
      if (this.ch_email()) channels.push('EMAIL');
      const predicate = this.rowsToPredicate(this.conditions());
      const payload: CreateNotificationRuleInput = {
        name: this.name().trim(),
        trigger: this.trigger(),
        predicate,
        channels,
        digestMode: this.digestMode(),
      };
      const e = this.existing();
      if (e) await this.store.update(e.id, payload);
      else await this.store.create(payload);
      this.dialog.close();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const msg = (err as { error?: { message?: string } }).error?.message;
      this.errorMessage.set(
        msg ??
          (status === 400
            ? 'Regel ist ungültig — bitte Felder prüfen'
            : 'Speichern fehlgeschlagen'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  private rowsToPredicate(rows: ConditionRow[]): Predicate {
    const clauses: Predicate[] = rows.map(r => ({
      op: 'cmp' as const,
      field: r.field,
      operator: r.operator,
      value: this.coerceValue(r.field, r.value),
    }));
    if (clauses.length === 1) return clauses[0];
    return { op: 'and', clauses };
  }

  private coerceValue(field: string, raw: string): string | number | boolean {
    const spec = TRIGGER_FIELDS[this.trigger()].find(f => f.field === field);
    if (!spec) return raw;
    if (spec.kind === 'money') {
      // UI accepts Euro (German or English notation); predicate stores cents.
      const euro = parseLocaleNumber(raw);
      if (euro === null) return 0;
      return Math.round(euro * 100);
    }
    if (spec.kind === 'integer' || spec.kind === 'percentage') {
      const n = parseLocaleNumber(raw);
      return n === null ? 0 : n;
    }
    if (spec.kind === 'boolean') {
      return raw === 'true' || raw === '1';
    }
    return raw;
  }

  private predicateToRows(predicate: Predicate): ConditionRow[] {
    if (predicate.op === 'cmp') {
      return [this.cmpToRow(predicate)];
    }
    if (predicate.op === 'and') {
      const rows: ConditionRow[] = [];
      for (const c of predicate.clauses) {
        if (c.op === 'cmp') rows.push(this.cmpToRow(c));
      }
      return rows.length > 0 ? rows : [{ field: 'amountCents', operator: '>', value: '0' }];
    }
    return [{ field: 'amountCents', operator: '>', value: '0' }];
  }

  private cmpToRow(cmp: Extract<Predicate, { op: 'cmp' }>): ConditionRow {
    const spec = TRIGGER_FIELDS[this.trigger()].find(f => f.field === cmp.field);
    let displayValue: string;
    if (spec?.kind === 'money' && typeof cmp.value === 'number') {
      // Reverse the cents→euro conversion for editing.
      displayValue = (cmp.value / 100).toLocaleString('de-DE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        useGrouping: false,
      });
    } else {
      displayValue = String(cmp.value ?? '');
    }
    return {
      field: cmp.field,
      operator: cmp.operator,
      value: displayValue,
    };
  }

  private operatorLabel(op: ComparisonOperator): string {
    switch (op) {
      case '=': return '=';
      case '!=': return '≠';
      case '>': return '>';
      case '>=': return '≥';
      case '<': return '<';
      case '<=': return '≤';
      case 'in': return 'in';
      case 'notIn': return 'nicht in';
      case 'contains': return 'enthält';
      case 'startsWith': return 'beginnt mit';
      case 'matches': return 'matcht (regex)';
    }
  }
}
