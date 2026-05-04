import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { HlmCheckboxComponent } from '../../shared/ui/hlm/hlm-checkbox.component';
import { KlarInputComponent } from '../../shared/ui/klar-input.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { HouseholdStore } from '../../core/household/household.store';
import { AuthStore } from '../../core/auth/auth.store';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { ApiKeysStore, AVAILABLE_SCOPES } from '../../core/api-keys/api-keys.store';
import type { ApiKeyListItem } from '../../core/api-keys/api-keys.service';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import type { InviteCode } from '@klar/shared';
import { MailTemplatesComponent } from './mail-templates/mail-templates.component';
import { KlarListComponent, KlarListGroupComponent, KlarListItemComponent } from '../../shared/ui/klar-list.component';

@Component({
  selector: 'app-haushalt',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [
    DatePipe,
    FormsModule,
    HlmButtonDirective,
    HlmSpinnerComponent,
    HlmCheckboxComponent,
    KlarInputComponent,
    KlarIconComponent,
    MailTemplatesComponent,
    KlarListComponent,
    KlarListGroupComponent,
    KlarListItemComponent,
  ],
  templateUrl: './haushalt.component.html',
  styleUrl: './haushalt.component.css',
})
export class HaushaltPageComponent implements OnInit {
  protected store = inject(HouseholdStore);
  protected apiKeysStore = inject(ApiKeysStore);
  private toast = inject(KlarToastService);
  private authStore = inject(AuthStore);

  readonly availableScopes = AVAILABLE_SCOPES;
  readonly authUserId = computed(() => this.authStore.user()?.id);

  readonly editingName = signal(false);
  readonly newName = signal('');
  readonly savingName = signal(false);
  readonly creatingInvite = signal(false);
  readonly newlyCreatedInvite = signal<InviteCode | null>(null);
  readonly joinCode = signal('');
  readonly joining = signal(false);
  readonly leavingHousehold = signal(false);
  readonly deletingHousehold = signal(false);

  readonly canManage = computed(() => this.store.isOwner());
  readonly isSoleOwner = computed(() => {
    const members = this.store.members();
    const owners = members.filter(m => m.role === 'OWNER');
    return owners.length === 1;
  });

  constructor() {
    inject(PageHeaderService).set({
      title:    'Haushalt',
      subtitle: 'VERWALTUNG & EINSTELLUNGEN',
    });
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.store.loadMembers(), this.store.loadInvites()]);
  }

  startEditName(): void {
    this.newName.set(this.store.activeName());
    this.editingName.set(true);
  }

  cancelEditName(): void {
    this.editingName.set(false);
  }

  async saveName(): Promise<void> {
    const name = this.newName().trim();
    if (!name) return;
    this.savingName.set(true);
    try {
      await this.store.rename(name);
      this.editingName.set(false);
      this.toast.success('Name gespeichert');
    } catch {
      this.toast.error('Name konnte nicht gespeichert werden');
    } finally {
      this.savingName.set(false);
    }
  }

  async createInvite(): Promise<void> {
    this.creatingInvite.set(true);
    this.newlyCreatedInvite.set(null);
    try {
      const invite = await this.store.createInvite({ expiresInDays: 7 });
      this.newlyCreatedInvite.set(invite);
    } catch {
      this.toast.error('Einladung konnte nicht erstellt werden');
    } finally {
      this.creatingInvite.set(false);
    }
  }

  async deleteInvite(inviteId: string): Promise<void> {
    try {
      await this.store.deleteInvite(inviteId);
      if (this.newlyCreatedInvite()?.id === inviteId) {
        this.newlyCreatedInvite.set(null);
      }
    } catch {
      this.toast.error('Einladung konnte nicht gelöscht werden');
    }
  }

  async removeMember(userId: string): Promise<void> {
    try {
      await this.store.removeMember(userId);
      this.toast.success('Mitglied entfernt');
    } catch {
      this.toast.error('Mitglied konnte nicht entfernt werden');
    }
  }

  async joinByCode(): Promise<void> {
    const code = this.joinCode().trim();
    if (!code) return;
    this.joining.set(true);
    try {
      await this.store.joinByCode(code);
      this.toast.success('Haushalt beigetreten');
    } catch (err: unknown) {
      const msg = (err as { error?: { detail?: string } }).error?.detail;
      this.toast.error(msg ?? 'Ungültiger Einladungscode');
    } finally {
      this.joining.set(false);
    }
  }

  formatCode(code: string): string {
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }

  formatInviteSublabel(invite: InviteCode): string | undefined {
    const parts: string[] = [];
    if (invite.expiresAt) {
      parts.push(`Ablauf: ${new Date(invite.expiresAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
    }
    if (invite.usesRemaining !== null) {
      parts.push(`Noch ${invite.usesRemaining} Nutzung(en)`);
    }
    return parts.length ? parts.join(' · ') : undefined;
  }

  formatApiKeySublabel(key: ApiKeyListItem): string {
    const parts: string[] = [];
    if (key.scopes?.length) parts.push(key.scopes.join(', '));
    parts.push(`Erstellt ${new Date(key.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
    if (key.lastUsedAt) {
      parts.push(`Zuletzt ${new Date(key.lastUsedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
    }
    return parts.join(' · ');
  }

  async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.formatCode(code));
      this.toast.success('Code kopiert');
    } catch {
      // clipboard not available
    }
  }

  async copyApiKey(key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(key);
      this.toast.success('API-Schlüssel kopiert');
    } catch {
      // clipboard not available
    }
  }

  async createApiKey(): Promise<void> {
    try {
      await this.apiKeysStore.createKey();
      this.toast.success('API-Schlüssel erstellt');
    } catch {
      this.toast.error('API-Schlüssel konnte nicht erstellt werden');
    }
  }

  async revokeApiKey(id: string): Promise<void> {
    try {
      await this.apiKeysStore.revokeKey(id);
      this.toast.success('API-Schlüssel widerrufen');
    } catch {
      this.toast.error('API-Schlüssel konnte nicht widerrufen werden');
    }
  }

  async deleteApiKey(id: string): Promise<void> {
    try {
      await this.apiKeysStore.deleteKey(id);
      this.toast.success('API-Schlüssel gelöscht');
    } catch {
      this.toast.error('API-Schlüssel konnte nicht gelöscht werden');
    }
  }

  async leaveHousehold(): Promise<void> {
    const confirmed = window.confirm('Möchtest du diesen Haushalt wirklich verlassen?');
    if (!confirmed) return;
    this.leavingHousehold.set(true);
    try {
      await this.store.leave();
      this.toast.success('Haushalt verlassen');
    } catch (err: unknown) {
      const msg = (err as { error?: { detail?: string } })?.error?.detail;
      this.toast.error(msg ?? 'Haushalt konnte nicht verlassen werden');
    } finally {
      this.leavingHousehold.set(false);
    }
  }

  async deleteHousehold(): Promise<void> {
    const name = this.store.activeName();
    const confirmed = window.confirm(
      `Haushalt "${name}" unwiderruflich löschen?\n\nAlle Daten gehen verloren.`,
    );
    if (!confirmed) return;
    this.deletingHousehold.set(true);
    try {
      await this.store.deleteActiveHousehold();
      this.toast.success('Haushalt gelöscht');
    } catch (err: unknown) {
      const msg = (err as { error?: { detail?: string } })?.error?.detail;
      this.toast.error(msg ?? 'Haushalt konnte nicht gelöscht werden');
    } finally {
      this.deletingHousehold.set(false);
    }
  }
}
