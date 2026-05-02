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
import { PageHeaderService } from '../../core/page-header/page-header.service';
import type { InviteCode } from '@klar/shared';

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
  readonly roleChangePending = signal<Record<string, boolean>>({});

  readonly editingName = signal(false);
  readonly newName = signal('');
  readonly savingName = signal(false);
  readonly creatingInvite = signal(false);
  readonly newlyCreatedInvite = signal<InviteCode | null>(null);
  readonly joinCode = signal('');
  readonly joining = signal(false);

  readonly canManage = computed(() => this.store.isOwner());
  readonly activeApiKeys = computed(() =>
    (this.apiKeysStore.keys() ?? []).filter(k => !k.isRevoked)
  );

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

  async changeRole(userId: string, newRole: 'OWNER' | 'MEMBER', event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const oldRole = this.store.members().find(m => m.userId === userId)?.role;
    select.value = oldRole ?? 'MEMBER';

    const memberName = this.store.members().find(m => m.userId === userId)?.displayName ?? userId;
    const roleLabel = newRole === 'OWNER' ? 'Owner' : 'Member';
    const confirmed = window.confirm(
      `${memberName} zu ${roleLabel} machen?\n\nOwner können Mitglieder einladen, entfernen und Rollen ändern.`,
    );
    if (!confirmed) return;

    this.roleChangePending.update(p => ({ ...p, [userId]: true }));
    try {
      await this.store.changeRole(userId, newRole);
      this.toast.success('Rolle geändert');
    } catch {
      this.toast.error('Rolle konnte nicht geändert werden');
    } finally {
      this.roleChangePending.update(p => {
        const next = { ...p };
        delete next[userId];
        return next;
      });
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
}
