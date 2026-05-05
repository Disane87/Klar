import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { HlmCheckboxComponent } from '../../shared/ui/hlm/hlm-checkbox.component';
import { KlarInputComponent } from '../../shared/ui/klar-input.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { HouseholdStore } from '../../core/household/household.store';
import { AuthStore } from '../../core/auth/auth.store';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { ApiKeysStore, AVAILABLE_SCOPES } from '../../core/api-keys/api-keys.store';
import type { ApiKeyListItem } from '../../core/api-keys/api-keys.service';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { MailTemplatesComponent } from './mail-templates/mail-templates.component';
import { InviteDialogComponent } from './invite-dialog.component';
import { KlarListComponent, KlarListGroupComponent, KlarListItemComponent } from '../../shared/ui/klar-list.component';

@Component({
  selector: 'app-haushalt',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [
    FormsModule,
    KlarButtonComponent,
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
  private dialogService = inject(KlarDialogService);

  readonly availableScopes = AVAILABLE_SCOPES;
  readonly authUserId = computed(() => this.authStore.user()?.id);

  readonly pendingInvites = computed(() =>
    this.store.invites().filter(i => !i.usedAt && !!i.email)
  );

  readonly editingName = signal(false);
  readonly newName = signal('');
  readonly savingName = signal(false);
  readonly leavingHousehold = signal(false);
  readonly deletingHousehold = signal(false);

  readonly canManage = computed(() => this.store.isOwner());
  readonly canInvite = computed(() => this.store.isOwner());
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
    await Promise.all([
      this.store.loadMembers(),
      this.canManage() ? this.store.loadInvites() : Promise.resolve(),
    ]);
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

  openInviteDialog(): void {
    this.dialogService.open({
      title: 'Mitglied einladen',
      component: InviteDialogComponent,
      width: 'md',
    });
  }

  async removeMember(userId: string): Promise<void> {
    try {
      await this.store.removeMember(userId);
      this.toast.success('Mitglied entfernt');
    } catch {
      this.toast.error('Mitglied konnte nicht entfernt werden');
    }
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

  inviteStatus(invite: { expiresAt?: string | null; usedAt?: string | null }): 'offen' | 'abgelaufen' {
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return 'abgelaufen';
    return 'offen';
  }

  inviteSubLabel(invite: { email?: string | null; expiresAt?: string | null; createdAt: string }): string {
    const parts: string[] = [];
    if (invite.email) parts.push(invite.email);
    if (invite.expiresAt) {
      const d = new Date(invite.expiresAt);
      if (d < new Date()) {
        parts.push(`Abgelaufen ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
      } else {
        parts.push(`Bis ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
      }
    }
    return parts.join(' · ');
  }

  async deleteInvite(inviteId: string): Promise<void> {
    try {
      await this.store.deleteInvite(inviteId);
      this.toast.success('Einladung gelöscht');
    } catch {
      this.toast.error('Einladung konnte nicht gelöscht werden');
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
