import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SCOPE_DISPLAY, type OAuthScope } from '@klar/shared';
import { KlarButtonComponent } from '../../../shared/ui/klar-button.component';
import { KlarIconComponent } from '../../../shared/icons/klar-icon.component';
import { HlmInputDirective } from '../../../shared/ui/hlm/hlm-input.directive';
import { KlarDialogService } from '../../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../../shared/ui/klar-toast.service';
import {
  OAuthGrantsService,
  type OAuthGrantSummary,
} from '../../../core/oauth/oauth-grants.service';

/**
 * Dialog-Inhalt: Liste verbundener Apps mit Revoke + Rename.
 *
 * Hintergrund Rename: `mcp-remote` registriert sich überall als
 * "MCP CLI Proxy" — der echte LLM-Client (Claude, Codex, …) wird
 * automatisch aus dem MCP-`clientInfo.name` übernommen, der User kann
 * aber auch manuell umbenennen.
 */
@Component({
  selector: 'app-connected-apps',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    KlarButtonComponent,
    KlarIconComponent,
    HlmInputDirective,
  ],
  templateUrl: './connected-apps.component.html',
})
export class ConnectedAppsComponent {
  private readonly api = inject(OAuthGrantsService);
  private readonly toast = inject(KlarToastService);
  readonly dialog = inject(KlarDialogService);

  readonly grants = signal<OAuthGrantSummary[]>([]);
  readonly loading = signal(true);
  readonly revoking = signal<string | null>(null);
  readonly renaming = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly draftName = signal('');
  readonly empty = computed(() => !this.loading() && this.grants().length === 0);

  constructor() {
    void this.reload();
  }

  scopeLabel(scope: string): string {
    return SCOPE_DISPLAY[scope as OAuthScope]?.title ?? scope;
  }

  scopeIsWrite(scope: string): boolean {
    return SCOPE_DISPLAY[scope as OAuthScope]?.write === true;
  }

  startRename(grant: OAuthGrantSummary): void {
    this.editingId.set(grant.id);
    this.draftName.set(grant.displayName ?? grant.originalClientName);
  }

  cancelRename(): void {
    this.editingId.set(null);
    this.draftName.set('');
  }

  async saveRename(grant: OAuthGrantSummary): Promise<void> {
    const next = this.draftName().trim();
    // Wenn auf Original zurückgesetzt → null senden (clearing override)
    const payload = next.length === 0 || next === grant.originalClientName ? null : next;
    if ((grant.displayName ?? null) === payload) {
      this.cancelRename();
      return;
    }
    this.renaming.set(grant.id);
    try {
      await firstValueFrom(this.api.rename(grant.id, payload));
      this.grants.update((items) =>
        items.map((g) =>
          g.id === grant.id
            ? { ...g, displayName: payload, clientName: payload ?? g.originalClientName }
            : g,
        ),
      );
      this.toast.success('Name aktualisiert');
      this.cancelRename();
    } catch {
      this.toast.error('Umbenennen fehlgeschlagen');
    } finally {
      this.renaming.set(null);
    }
  }

  async resetName(grant: OAuthGrantSummary): Promise<void> {
    if (!grant.displayName) return;
    this.renaming.set(grant.id);
    try {
      await firstValueFrom(this.api.rename(grant.id, null));
      this.grants.update((items) =>
        items.map((g) =>
          g.id === grant.id
            ? { ...g, displayName: null, clientName: g.originalClientName }
            : g,
        ),
      );
      this.toast.success('Original-Name wiederhergestellt');
    } catch {
      this.toast.error('Zurücksetzen fehlgeschlagen');
    } finally {
      this.renaming.set(null);
    }
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await firstValueFrom(this.api.list());
      this.grants.set(list);
    } catch {
      this.toast.error('Verbundene Apps konnten nicht geladen werden.');
    } finally {
      this.loading.set(false);
    }
  }

  async revoke(grant: OAuthGrantSummary): Promise<void> {
    if (this.revoking()) return;
    this.revoking.set(grant.id);
    try {
      await firstValueFrom(this.api.revoke(grant.id));
      this.grants.update((items) => items.filter((g) => g.id !== grant.id));
      this.toast.success(`${grant.clientName} wurde widerrufen.`);
    } catch {
      this.toast.error('Widerruf fehlgeschlagen.');
    } finally {
      this.revoking.set(null);
    }
  }
}
