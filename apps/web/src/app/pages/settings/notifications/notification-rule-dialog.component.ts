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
  type Schedule,
  type ScheduleType,
} from '@klar/shared';
import { NotificationRulesService as NotificationRulesApi } from '../../../core/notification-rules/notification-rules.service';
import { HouseholdStore } from '../../../core/household/household.store';
import { firstValueFrom } from 'rxjs';
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
          Triggert die Auswertung. Bedingungen nutzen die Felder dieses Auslösers.
        </span>
      </div>

      <div class="flex items-center justify-between gap-2">
        <span class="text-[11px] uppercase tracking-widest text-(--fg-2)">
          {{ advancedMode() ? 'Erweitert (JSON)' : 'Bedingungen (alle müssen zutreffen)' }}
        </span>
        <button
          type="button"
          class="text-[11px] text-(--accent) hover:opacity-80"
          (click)="toggleAdvanced()"
        >
          {{ advancedMode() ? '← Einfacher Modus' : 'Erweitert (AND / OR / NOT) →' }}
        </button>
      </div>

      @if (advancedMode()) {
        <fieldset class="flex flex-col gap-2 border border-(--line-soft) rounded-md p-3">
          <textarea
            class="hlm-input min-h-[160px] mono text-[12px]"
            [ngModel]="advancedJson()"
            (ngModelChange)="advancedJson.set($event)"
            name="predicate-json"
            spellcheck="false"
            placeholder='{"op":"or","clauses":[{"op":"cmp","field":"amountCents","operator":">","value":100000},{"op":"and","clauses":[{"op":"cmp","field":"isIncome","operator":"=","value":true},{"op":"not","clause":{"op":"cmp","field":"counterparty","operator":"contains","value":"test"}}]}]}'
          ></textarea>
          @if (advancedError()) {
            <span class="text-[11px] text-(--danger)">{{ advancedError() }}</span>
          } @else {
            <span class="text-[11px] text-(--fg-3)">
              Roh-Predicate als JSON — erlaubt AND/OR/NOT-Verschachtelung. Wird beim
              Speichern serverseitig gegen die Trigger-Whitelist validiert.
            </span>
          }
        </fieldset>
      } @else {
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
      }

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

      @if (trigger() === 'SCHEDULED') {
        <fieldset class="flex flex-col gap-2 border border-(--line-soft) rounded-md p-3">
          <legend class="text-[11px] uppercase tracking-widest text-(--fg-2) px-1">
            Zeitplan
          </legend>
          <div class="flex flex-wrap items-center gap-2">
            <klar-select
              [options]="scheduleTypeOptions"
              [value]="scheduleType()"
              (valueChange)="setScheduleType($event)"
              ariaLabel="Häufigkeit"
            />
            <input
              class="hlm-input w-24"
              type="time"
              [ngModel]="scheduleTime()"
              (ngModelChange)="scheduleTime.set($event)"
              name="schedule-time"
            />
            @if (scheduleType() === 'weekly') {
              <klar-select
                [options]="dayOfWeekOptions"
                [value]="scheduleDayOfWeek() + ''"
                (valueChange)="scheduleDayOfWeek.set(+$event)"
                ariaLabel="Wochentag"
              />
            }
            @if (scheduleType() === 'monthly') {
              <input
                class="hlm-input w-20"
                type="number"
                min="1"
                max="31"
                [ngModel]="scheduleDayOfMonth()"
                (ngModelChange)="scheduleDayOfMonth.set(+$event)"
                name="schedule-day-of-month"
              />
              <span class="text-[12px] text-(--fg-3)">des Monats</span>
            }
          </div>
          <span class="text-[11px] text-(--fg-3)">
            Wird zur angegebenen Zeit (Europe/Berlin) ausgewertet.
            Bedingungen für SCHEDULED-Regeln müssen Aggregationen nutzen
            (z. B. Kontostand, Summe der letzten 30 Tage).
          </span>
        </fieldset>
      }

      @if (trigger() === 'TRANSACTION_CREATED') {
        <div class="flex items-center justify-between gap-3 border-t border-(--line-soft) pt-2">
          <span class="text-[11px] text-(--fg-3)">
            @if (previewResult(); as r) {
              In den letzten 90 Tagen hätte das {{ r.count }}× gefeuert.
              @if (r.count > 0) {
                Beispiel: {{ r.sample[0] }}
              }
            } @else {
              Live-Vorschau gegen die letzten 90 Tage.
            }
          </span>
          <klar-button
            tone="ghost"
            size="sm"
            [disabled]="!canSave() || previewing()"
            (click)="onPreview()"
          >
            {{ previewing() ? 'Prüfe …' : 'Vorschau' }}
          </klar-button>
        </div>
      }

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
  // Schedule (only relevant when trigger=SCHEDULED).
  protected readonly scheduleType = signal<ScheduleType>('daily');
  protected readonly scheduleTime = signal('08:00');
  protected readonly scheduleDayOfWeek = signal<number>(1); // Monday
  protected readonly scheduleDayOfMonth = signal<number>(1);
  // Live-preview result.
  protected readonly previewing = signal(false);
  protected readonly previewResult = signal<{ count: number; sample: string[] } | null>(null);
  // Erweitert-Mode: raw JSON predicate (for AND/OR/NOT trees the flat
  // builder can't express). Backend validates the schema; the textarea
  // only does shape parsing locally.
  protected readonly advancedMode = signal(false);
  protected readonly advancedJson = signal('');
  protected readonly advancedError = signal<string | null>(null);

  private readonly api = inject(NotificationRulesApi);
  private readonly householdStore = inject(HouseholdStore);
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

  protected readonly scheduleTypeOptions: KlarSelectOption[] = [
    { value: 'daily', label: 'Täglich' },
    { value: 'weekly', label: 'Wöchentlich' },
    { value: 'monthly', label: 'Monatlich' },
  ];

  protected readonly dayOfWeekOptions: KlarSelectOption[] = [
    { value: '1', label: 'Mo' },
    { value: '2', label: 'Di' },
    { value: '3', label: 'Mi' },
    { value: '4', label: 'Do' },
    { value: '5', label: 'Fr' },
    { value: '6', label: 'Sa' },
    { value: '0', label: 'So' },
  ];

  protected toggleAdvanced(): void {
    const next = !this.advancedMode();
    if (next) {
      // Going INTO advanced: serialize the current flat predicate so the
      // textarea starts from where the user already was.
      this.advancedJson.set(
        JSON.stringify(this.rowsToPredicate(this.conditions()), null, 2),
      );
      this.advancedError.set(null);
    } else {
      // Going BACK to simple: try to reduce the JSON back to a flat-AND.
      // If it's actually a recursive tree, refuse and stay in advanced.
      const parsed = this.tryParseAdvancedJson();
      if (parsed && this.isFlatAndPredicate(parsed)) {
        this.conditions.set(this.predicateToRows(parsed));
      } else if (parsed) {
        this.advancedError.set(
          'Bedingung enthält OR / NOT — nicht im einfachen Modus darstellbar',
        );
        return;
      }
    }
    this.advancedMode.set(next);
  }

  private tryParseAdvancedJson(): Predicate | null {
    try {
      return JSON.parse(this.advancedJson()) as Predicate;
    } catch {
      this.advancedError.set('JSON ist nicht valide');
      return null;
    }
  }

  private isFlatAndPredicate(p: Predicate): boolean {
    if (p.op === 'cmp') return true;
    if (p.op === 'and') return p.clauses.every(c => c.op === 'cmp');
    return false;
  }

  protected setScheduleType(value: string): void {
    if (value === 'daily' || value === 'weekly' || value === 'monthly') {
      this.scheduleType.set(value);
    }
  }

  protected readonly fieldOptions = computed<KlarSelectOption[]>(() =>
    TRIGGER_FIELDS[this.trigger()].map(f => ({ value: f.field, label: f.label })),
  );

  protected readonly canSave = computed(() => {
    if (!this.name().trim()) return false;
    if (this.advancedMode()) {
      if (!this.advancedJson().trim()) return false;
    } else {
      if (this.conditions().length === 0) return false;
      if (this.conditions().some(c => !c.value && c.field !== 'isIncome')) return false;
    }
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
    if (this.isFlatAndPredicate(e.predicate)) {
      this.conditions.set(this.predicateToRows(e.predicate));
    } else {
      this.advancedMode.set(true);
      this.advancedJson.set(JSON.stringify(e.predicate, null, 2));
    }
    if (e.schedule) {
      this.scheduleType.set(e.schedule.type);
      this.scheduleTime.set(e.schedule.time);
      if (typeof e.schedule.dayOfWeek === 'number') {
        this.scheduleDayOfWeek.set(e.schedule.dayOfWeek);
      }
      if (typeof e.schedule.dayOfMonth === 'number') {
        this.scheduleDayOfMonth.set(e.schedule.dayOfMonth);
      }
    }
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

  protected async onPreview(): Promise<void> {
    const householdId = this.householdStore.activeId();
    if (!householdId) return;
    this.previewing.set(true);
    try {
      const result = await firstValueFrom(
        this.api.preview(householdId, {
          trigger: this.trigger(),
          predicate: this.rowsToPredicate(this.conditions()),
          days: 90,
        }),
      );
      this.previewResult.set({
        count: result.wouldHaveFiredCount,
        sample: result.sample.map(
          s => `${s.at} · ${s.title} (${(s.amountCents / 100).toFixed(2)} €)`,
        ),
      });
    } catch {
      this.previewResult.set({ count: 0, sample: ['Vorschau fehlgeschlagen'] });
    } finally {
      this.previewing.set(false);
    }
  }

  protected async save(): Promise<void> {
    this.errorMessage.set(null);
    this.saving.set(true);
    try {
      const channels: NotificationChannel[] = [];
      if (this.ch_inApp()) channels.push('IN_APP');
      if (this.ch_webPush()) channels.push('WEB_PUSH');
      if (this.ch_email()) channels.push('EMAIL');
      let predicate: Predicate;
      if (this.advancedMode()) {
        const parsed = this.tryParseAdvancedJson();
        if (!parsed) {
          this.errorMessage.set('JSON-Predicate ist nicht valide');
          return;
        }
        predicate = parsed;
      } else {
        predicate = this.rowsToPredicate(this.conditions());
      }
      const payload: CreateNotificationRuleInput = {
        name: this.name().trim(),
        trigger: this.trigger(),
        predicate,
        channels,
        digestMode: this.digestMode(),
      };
      if (this.trigger() === 'SCHEDULED') {
        const schedule: Schedule = { type: this.scheduleType(), time: this.scheduleTime() };
        if (schedule.type === 'weekly') schedule.dayOfWeek = this.scheduleDayOfWeek();
        if (schedule.type === 'monthly') schedule.dayOfMonth = this.scheduleDayOfMonth();
        payload.schedule = schedule;
      }
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
