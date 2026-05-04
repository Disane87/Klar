import { Component, effect, inject, signal } from '@angular/core';
import { KlarDialogService } from '../../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../../shared/ui/klar-toast.service';
import { HouseholdStore } from '../../../core/household/household.store';
import {
  type HouseholdMailTemplate,
  type MailTemplateType,
  MailTemplateService,
} from '../../../core/mail-template/mail-template.service';
import { MailTemplateEditDialogComponent } from './mail-template-edit-dialog.component';
import { KlarListGroupComponent, KlarListItemComponent } from '../../../shared/ui/klar-list.component';

@Component({
  selector: 'app-mail-templates',
  standalone: true,
  imports: [KlarListGroupComponent, KlarListItemComponent],
  host: { class: 'block' },
  template: `
    <klar-list-group label="Mail-Vorlagen"
                     headerActionLabel="+ Neu"
                     [loading]="loading()"
                     (headerAction)="openCreateDialog()">
      @if (!loading() && templates().length === 0) {
        <p class="px-6 py-4 text-[13px] text-(--text-muted)">Keine Mail-Vorlagen vorhanden.</p>
      }
      @for (template of templates(); track template.templateType) {
        <klar-list-item
          [label]="template.name"
          [sublabel]="template.subject"
          [badge]="getTypeLabel(template.templateType)"
          [badgeClass]="getTypeBadgeClass(template.templateType)"
          trailingActionIcon="pencil"
          (trailingActionClick)="openEditDialog(template)" />
      }
    </klar-list-group>
  `,
})
export class MailTemplatesComponent {
  private mailTemplateService = inject(MailTemplateService);
  private toast = inject(KlarToastService);
  private hhStore = inject(HouseholdStore);
  private dialog = inject(KlarDialogService);

  readonly templates = signal<HouseholdMailTemplate[]>([]);
  readonly loading = signal(true);

  constructor() {
    effect(() => {
      if (this.hhStore.isInitialized()) {
        this.loadTemplates();
      }
    });

    effect(() => {
      const active = this.dialog.active();
      if (!active && this.hhStore.isInitialized()) {
        this.loadTemplates();
      }
    });
  }

  async loadTemplates(): Promise<void> {
    const hid = this.hhStore.activeId();
    if (!hid) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    try {
      const templates = await this.mailTemplateService.getTemplates(hid, '');
      this.templates.set(templates);
    } catch {
      this.toast.error('Vorlagen konnten nicht geladen werden');
    } finally {
      this.loading.set(false);
    }
  }

  getTypeLabel(type: MailTemplateType): string {
    const labels: Record<MailTemplateType, string> = {
      INVITE: 'Einladung',
      REMINDER: 'Erinnerung',
      CUSTOM: 'Benutzerdefiniert',
      EMAIL_VERIFY: 'E-Mail bestätigen',
      PASSWORD_RESET: 'Passwort zurücksetzen',
      TOTP_ENABLE: '2FA aktiviert',
      TOTP_DISABLE: '2FA deaktiviert',
      API_KEY_CREATED: 'API-Key erstellt',
    };
    return labels[type] || type;
  }

  getTypeBadgeClass(type: MailTemplateType): string {
    const classes: Record<MailTemplateType, string> = {
      INVITE: 'bg-sky-500/20 text-sky-400',
      REMINDER: 'bg-amber-500/20 text-amber-400',
      CUSTOM: 'bg-violet-500/20 text-violet-400',
      EMAIL_VERIFY: 'bg-emerald-500/20 text-emerald-400',
      PASSWORD_RESET: 'bg-rose-500/20 text-rose-400',
      TOTP_ENABLE: 'bg-cyan-500/20 text-cyan-400',
      TOTP_DISABLE: 'bg-orange-500/20 text-orange-400',
      API_KEY_CREATED: 'bg-indigo-500/20 text-indigo-400',
    };
    return classes[type] || 'bg-zinc-500/20 text-zinc-400';
  }

  openEditDialog(template: HouseholdMailTemplate): void {
    this.dialog.open({
      title: template.name,
      component: MailTemplateEditDialogComponent,
      inputs: { template, isNew: false },
      width: 'md',
    });
  }

  openCreateDialog(): void {
    this.dialog.open({
      title: 'Neue Vorlage',
      component: MailTemplateEditDialogComponent,
      inputs: { isNew: true },
      width: 'md',
    });
  }
}