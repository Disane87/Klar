import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '../../../shared/ui/hlm/hlm-button.directive';
import { HlmInputDirective } from '../../../shared/ui/hlm/hlm-input.directive';
import { HlmLabelDirective } from '../../../shared/ui/hlm/hlm-label.directive';
import { HlmSpinnerComponent } from '../../../shared/ui/hlm/hlm-spinner.component';
import { KlarDialogService } from '../../../shared/ui/klar-dialog.service';
import { HouseholdStore } from '../../../core/household/household.store';
import {
  type HouseholdMailTemplate,
  type MailTemplateType,
  MailTemplateService,
} from '../../../core/mail-template/mail-template.service';
import { KlarToastService } from '../../../shared/ui/klar-toast.service';

@Component({
  selector: 'app-mail-template-edit-dialog',
  standalone: true,
  imports: [
    FormsModule,
    HlmButtonDirective,
    HlmInputDirective,
    HlmLabelDirective,
    HlmSpinnerComponent,
  ],
  template: `
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label hlmLabel>Typ</label>
          <select hlmInput [(ngModel)]="formTemplateType" [disabled]="!isNew()">
            <option value="INVITE">Einladung</option>
            <option value="REMINDER">Erinnerung</option>
            <option value="CUSTOM">Benutzerdefiniert</option>
            <option value="EMAIL_VERIFY">E-Mail bestätigen</option>
            <option value="PASSWORD_RESET">Passwort zurücksetzen</option>
            <option value="TOTP_ENABLE">2FA aktiviert</option>
            <option value="TOTP_DISABLE">2FA deaktiviert</option>
            <option value="API_KEY_CREATED">API-Key erstellt</option>
          </select>
        </div>
        <div class="flex flex-col gap-1.5">
          <label hlmLabel>Name</label>
          <input hlmInput [(ngModel)]="formName" placeholder="Meine Einladung" />
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label hlmLabel>Betreff</label>
        <input hlmInput [(ngModel)]="formSubject"
               [placeholder]="getDefaultSubject(formTemplateType)" />
      </div>

      <div class="flex flex-col gap-1.5">
        <label hlmLabel>Inhalt (Handlebars HTML)</label>
        <textarea
          [(ngModel)]="formBody"
          class="w-full min-h-48 bg-(--surface-2) border border-(--border) rounded-md px-3 py-2 text-[13px] font-mono text-(--text) focus:outline-none focus:ring-1 focus:ring-accent resize-y"
          [placeholder]="getDefaultBody(formTemplateType)"
          spellcheck="false">
        </textarea>
      </div>

      @if (err()) {
        <p class="text-[12px] text-(--color-expense)">{{ err() }}</p>
      }

      <div class="flex justify-end gap-2 pt-2 border-t border-(--border)">
        <button hlmBtn variant="ghost" size="sm" type="button" (click)="cancel()">Abbrechen</button>
        <button hlmBtn variant="default" size="sm" type="button"
                [disabled]="saving()" (click)="onSave()">
          @if (saving()) { <hlm-spinner [size]="12" /> }
          Speichern
        </button>
      </div>
    </div>
  `,
})
export class MailTemplateEditDialogComponent {
  private mailTemplateService = inject(MailTemplateService);
  private toast               = inject(KlarToastService);
  private hhStore             = inject(HouseholdStore);
  private dialog              = inject(KlarDialogService);

  readonly template = input<HouseholdMailTemplate>();
  readonly isNew    = input(false);

  readonly saving = signal(false);
  readonly err    = signal('');

  formTemplateType: MailTemplateType = 'INVITE';
  formName    = '';
  formSubject = '';
  formBody    = '';

  constructor() {
    effect(() => {
      const t = this.template();
      if (t) {
        this.formTemplateType = t.templateType;
        this.formName         = t.name;
        this.formSubject      = t.subject;
        this.formBody         = t.body;
      }
    });
  }

  cancel(): void { this.dialog.close(); }

  async onSave(): Promise<void> {
    const hid = this.hhStore.activeId();
    if (!hid) return;

    if (!this.formName.trim()) {
      this.toast.error('Name ist erforderlich');
      return;
    }
    if (!this.formSubject.trim()) {
      this.toast.error('Betreff ist erforderlich');
      return;
    }
    if (!this.formBody.trim()) {
      this.toast.error('Inhalt ist erforderlich');
      return;
    }

    this.saving.set(true);
    this.err.set('');
    try {
      if (this.isNew()) {
        await this.mailTemplateService.createTemplate(hid, '', {
          templateType: this.formTemplateType,
          name:         this.formName,
          subject:      this.formSubject,
          body:         this.formBody,
        });
        this.toast.success('Vorlage erstellt');
      } else {
        await this.mailTemplateService.updateTemplate(hid, '', this.formTemplateType, {
          name:    this.formName,
          subject: this.formSubject,
          body:    this.formBody,
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

  getDefaultSubject(type: MailTemplateType): string {
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
    return defaults[type] ?? '';
  }

  getDefaultBody(type: MailTemplateType): string {
    const defaults: Record<MailTemplateType, string> = {
      INVITE:          '<h1>Hallo {{displayName}}</h1><p>Du wurdest zu {{householdName}} eingeladen.</p>',
      REMINDER:        '<h1>Hallo {{displayName}}</h1><p>Vergiss nicht, deine Fixkosten zu aktualisieren!</p>',
      CUSTOM:          '<h1>Hallo {{displayName}}</h1><p>Deine Nachricht...</p>',
      EMAIL_VERIFY:    '<h1>Hallo {{displayName}}</h1><p>Bitte bestätige deine E-Mail-Adresse.</p><a href="{{verifyUrl}}">Bestätigen</a>',
      PASSWORD_RESET:  '<h1>Hallo {{displayName}}</h1><p>Du kannst dein Passwort zurücksetzen.</p><a href="{{resetUrl}}">Passwort zurücksetzen</a>',
      TOTP_ENABLE:     '<h1>Hallo {{displayName}}</h1><p>2FA wurde für dein Konto aktiviert.</p>',
      TOTP_DISABLE:    '<h1>Hallo {{displayName}}</h1><p>2FA wurde für dein Konto deaktiviert.</p>',
      API_KEY_CREATED: '<h1>Hallo {{displayName}}</h1><p>Ein neuer API-Key wurde erstellt: {{keyName}}</p>',
    };
    return defaults[type] ?? '';
  }
}
