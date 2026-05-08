import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HlmInputDirective } from '../../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../../shared/ui/hlm/hlm-label.directive';
import { HlmTabsImports } from '../../../shared/ui/hlm/hlm-tabs';
import { KlarSelectComponent, type KlarSelectOption } from '../../../shared/ui/klar-select.component';
import { KlarDialogService } from '../../../shared/ui/klar-dialog.service';
import { KlarDialogFooterComponent } from '../../../shared/ui/klar-dialog-footer.component';
import { KlarCodeEditorComponent } from '../../../shared/ui/klar-code-editor.component';
import { HouseholdStore } from '../../../core/household/household.store';
import {
  type HouseholdMailTemplate,
  type MailTemplateType,
  MailTemplateService,
} from '../../../core/mail-template/mail-template.service';
import { KlarToastService } from '../../../shared/ui/klar-toast.service';

interface Placeholder {
  key: string;
  label: string;
  example: string;
}

const PLACEHOLDERS: Record<MailTemplateType, Placeholder[]> = {
  INVITE: [
    { key: 'displayName',   label: 'Anzeigename',     example: 'Max Mustermann' },
    { key: 'householdName', label: 'Haushalt',         example: 'Familie Mustermann' },
    { key: 'inviteLink',    label: 'Einladungslink',   example: 'https://klar.app/invite/abc123' },
    { key: 'expiresAt',     label: 'Ablaufdatum',      example: '01.06.2026' },
  ],
  REMINDER: [
    { key: 'displayName',   label: 'Anzeigename', example: 'Max Mustermann' },
    { key: 'householdName', label: 'Haushalt',     example: 'Familie Mustermann' },
  ],
  CUSTOM: [
    { key: 'displayName',   label: 'Anzeigename', example: 'Max Mustermann' },
    { key: 'householdName', label: 'Haushalt',     example: 'Familie Mustermann' },
  ],
  EMAIL_VERIFY: [
    { key: 'displayName', label: 'Anzeigename',        example: 'Max Mustermann' },
    { key: 'verifyUrl',   label: 'Bestätigungslink',   example: 'https://klar.app/verify/abc123' },
  ],
  PASSWORD_RESET: [
    { key: 'displayName', label: 'Anzeigename', example: 'Max Mustermann' },
    { key: 'resetUrl',    label: 'Reset-Link',  example: 'https://klar.app/reset/abc123' },
  ],
  TOTP_ENABLE:  [{ key: 'displayName', label: 'Anzeigename', example: 'Max Mustermann' }],
  TOTP_DISABLE: [{ key: 'displayName', label: 'Anzeigename', example: 'Max Mustermann' }],
  API_KEY_CREATED: [
    { key: 'displayName', label: 'Anzeigename', example: 'Max Mustermann' },
    { key: 'keyName',     label: 'Key-Name',    example: 'Mein API-Key' },
  ],
};

function fillPlaceholders(text: string, placeholders: Placeholder[]): string {
  let result = text;
  for (const p of placeholders) {
    result = result.replaceAll(`{{${p.key}}}`, p.example);
  }
  return result;
}

@Component({
  selector: 'app-mail-template-edit-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    HlmInputDirective,
    HlmLabelDirective,
    HlmTabsImports,
    KlarSelectComponent,
    KlarDialogFooterComponent,
    KlarCodeEditorComponent,
  ],
  host: { class: 'flex flex-col h-full' },
  template: `
    <!-- Top fields -->
    <div class="flex flex-col gap-3 pb-4 border-b border-(--border) shrink-0">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="flex flex-col gap-1.5">
          <label hlmLabel>Typ</label>
          <klar-select
            [options]="templateTypeOpts"
            [(ngModel)]="formTemplateType"
            [disabled]="!isNew()"
            ariaLabel="Template-Typ"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label hlmLabel>Name</label>
          <input hlmInput [(ngModel)]="formName" placeholder="Meine Einladung" />
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label hlmLabel>Betreff</label>
        <input hlmInput [(ngModel)]="formSubject" [placeholder]="defaultSubject()" />
      </div>
    </div>

    <!-- Tabs: Editor / Vorschau / Platzhalter -->
    <div hlmTabs="editor" class="flex flex-col flex-1 min-h-0 pt-4 gap-3">
      <div hlmTabsList
           class="inline-flex h-9 items-center justify-start rounded-md bg-(--surface-2) p-1 text-(--text-muted) self-start">
        <button hlmTabsTrigger="editor"   class="text-[12px]">Editor</button>
        <button hlmTabsTrigger="preview"  class="text-[12px]">Vorschau</button>
        <button hlmTabsTrigger="placeholders" class="text-[12px]">
          Platzhalter <span class="ml-1 opacity-60">{{ placeholders().length }}</span>
        </button>
      </div>

      <!-- Editor tab -->
      <div hlmTabsContent="editor" class="flex-1 min-h-0 flex flex-col">
        <div class="flex-1 min-h-0 rounded border border-(--border) overflow-hidden">
          <klar-code-editor
            #editor
            [initialValue]="formBody()"
            (valueChange)="formBody.set($event)"
            class="h-full" />
        </div>
      </div>

      <!-- Preview tab -->
      <div hlmTabsContent="preview" class="flex-1 min-h-0 flex flex-col gap-2">
        @if (previewSubject()) {
          <div class="flex flex-col gap-0.5 shrink-0">
            <span class="text-[10px] text-(--text-muted) uppercase tracking-wider">Betreff (Testdaten)</span>
            <div class="px-2.5 py-1.5 rounded bg-(--surface-2) border border-(--border)
                        text-[12px] text-(--text) font-medium truncate">
              {{ previewSubject() }}
            </div>
          </div>
        }
        <div class="flex-1 min-h-0 rounded border border-(--border) bg-white overflow-auto">
          <div class="text-[12px] text-black p-3 [&_a]:text-blue-600 [&_h1]:text-xl
                      [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold
                      [&_p]:my-2 [&_a]:underline preview-body"
               [innerHTML]="safePreviewHtml()">
          </div>
        </div>
      </div>

      <!-- Placeholders tab -->
      <div hlmTabsContent="placeholders" class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
        <p class="text-[12px] text-(--text-muted)">Auf einen Chip klicken, um den Platzhalter an der Cursor-Position einzufügen.</p>
        <div class="flex flex-wrap gap-1.5">
          @for (p of placeholders(); track p.key) {
            <button type="button"
                    (click)="insertPlaceholder(p.key)"
                    class="inline-flex items-center px-2 py-1 rounded text-xs font-mono
                           bg-(--surface-2) border border-(--border) text-(--text-muted)
                           hover:border-(--accent) hover:text-(--accent) transition-colors cursor-pointer">
              {{ '{{' + p.key + '}}' }}
            </button>
          }
        </div>
        <div class="grid grid-cols-1 gap-1 pt-2 border-t border-(--border)">
          @for (p of placeholders(); track p.key) {
            <div class="flex items-baseline gap-3 text-xs">
              <code class="font-mono text-(--text) w-40 shrink-0 truncate">{{ '{{' + p.key + '}}' }}</code>
              <span class="text-(--text-muted) truncate">{{ p.label }}</span>
              <span class="text-(--text-muted)/60 truncate ml-auto">{{ p.example }}</span>
            </div>
          }
        </div>
      </div>
    </div>

    <klar-dialog-footer
      class="mt-4 shrink-0"
      confirmLabel="Speichern"
      [confirmLoading]="saving()"
      [autoCloseOnCancel]="false"
      (cancel)="cancel()"
      (confirm)="onSave()"
    >
      @if (err()) {
        <p start class="text-[12px] text-(--color-expense) self-center">{{ err() }}</p>
      }
    </klar-dialog-footer>
  `,
})
export class MailTemplateEditDialogComponent {
  @ViewChild('editor') private editorRef?: KlarCodeEditorComponent;

  private mailTemplateService = inject(MailTemplateService);
  private toast               = inject(KlarToastService);
  private hhStore             = inject(HouseholdStore);
  private dialog              = inject(KlarDialogService);
  private sanitizer           = inject(DomSanitizer);

  readonly template = input<HouseholdMailTemplate>();
  readonly isNew    = input(false);

  readonly saving = signal(false);
  readonly err    = signal('');

  formTemplateType = 'INVITE' as MailTemplateType;

  protected readonly templateTypeOpts: KlarSelectOption<MailTemplateType>[] = [
    { value: 'INVITE',          label: 'Einladung' },
    { value: 'REMINDER',        label: 'Erinnerung' },
    { value: 'CUSTOM',          label: 'Benutzerdefiniert' },
    { value: 'EMAIL_VERIFY',    label: 'E-Mail bestätigen' },
    { value: 'PASSWORD_RESET',  label: 'Passwort zurücksetzen' },
    { value: 'TOTP_ENABLE',     label: '2FA aktiviert' },
    { value: 'TOTP_DISABLE',    label: '2FA deaktiviert' },
    { value: 'API_KEY_CREATED', label: 'API-Key erstellt' },
  ];

  readonly formName    = signal('');
  readonly formSubject = signal('');
  readonly formBody    = signal('');

  readonly placeholders = computed(() => PLACEHOLDERS[this.formTemplateType] ?? []);

  readonly previewSubject = computed(() =>
    fillPlaceholders(this.formSubject(), this.placeholders())
  );

  readonly safePreviewHtml = computed<SafeHtml>(() => {
    const filled = fillPlaceholders(this.formBody(), this.placeholders());
    return this.sanitizer.bypassSecurityTrustHtml(filled);
  });

  readonly defaultSubject = computed(() => {
    const defaults: Record<MailTemplateType, string> = {
      INVITE:          'Einladung zu {{householdName}} — Klar',
      REMINDER:        'Erinnerung: {{householdName}} — Klar',
      CUSTOM:          '',
      EMAIL_VERIFY:    'Bitte bestätige deine E-Mail-Adresse — Klar',
      PASSWORD_RESET:  'Passwort zurücksetzen — Klar',
      TOTP_ENABLE:     '2FA aktiviert — Klar',
      TOTP_DISABLE:    '2FA deaktiviert — Klar',
      API_KEY_CREATED: 'Neuer API-Key erstellt — Klar',
    };
    return defaults[this.formTemplateType] ?? '';
  });

  constructor() {
    effect(() => {
      const t = this.template();
      if (t) {
        this.formTemplateType = t.templateType;
        this.formName.set(t.name);
        this.formSubject.set(t.subject);
        this.formBody.set(t.body);
      }
    });
  }

  insertPlaceholder(key: string): void {
    this.editorRef?.insertAtCursor(`{{${key}}}`);
  }

  cancel(): void { this.dialog.close(); }

  async onSave(): Promise<void> {
    const hid = this.hhStore.activeId();
    if (!hid) return;

    const name    = this.formName().trim();
    const subject = this.formSubject().trim();
    const body    = this.formBody().trim();

    if (!name)    { this.toast.error('Name ist erforderlich');    return; }
    if (!subject) { this.toast.error('Betreff ist erforderlich'); return; }
    if (!body)    { this.toast.error('Inhalt ist erforderlich');  return; }

    this.saving.set(true);
    this.err.set('');
    try {
      if (this.isNew()) {
        await this.mailTemplateService.createTemplate(hid, '', {
          templateType: this.formTemplateType,
          name, subject, body,
        });
        this.toast.success('Vorlage erstellt');
      } else {
        await this.mailTemplateService.updateTemplate(hid, '', this.formTemplateType, {
          name, subject, body,
        });
        this.toast.success('Vorlage gespeichert');
      }
      this.dialog.close();
    } catch {
      this.err.set('Vorlage konnte nicht gespeichert werden');
    } finally {
      this.saving.set(false);
    }
  }
}
