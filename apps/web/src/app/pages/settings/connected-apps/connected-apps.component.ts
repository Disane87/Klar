import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { SCOPE_DISPLAY, type OAuthScope } from '@klar/shared';
import { KlarButtonComponent } from '../../../shared/ui/klar-button.component';
import { KlarIconComponent } from '../../../shared/icons/klar-icon.component';
import {
  OAuthGrantsService,
  type OAuthGrantSummary,
} from '../../../core/oauth/oauth-grants.service';
import { KlarToastService } from '../../../shared/ui/klar-toast.service';

@Component({
  selector: 'app-connected-apps',
  standalone: true,
  imports: [DatePipe, KlarButtonComponent, KlarIconComponent],
  templateUrl: './connected-apps.component.html',
})
export class ConnectedAppsComponent {
  private readonly api = inject(OAuthGrantsService);
  private readonly toast = inject(KlarToastService);

  readonly grants = signal<OAuthGrantSummary[]>([]);
  readonly loading = signal(true);
  readonly revoking = signal<string | null>(null);
  readonly empty = computed(() => !this.loading() && this.grants().length === 0);

  constructor() {
    void this.reload();
  }

  scopeLabel(scope: string): string {
    const display = SCOPE_DISPLAY[scope as OAuthScope];
    return display ? display.title : scope;
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
