import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '../../shared/ui/hlm/hlm-button.directive';
import { HlmSpinnerComponent } from '../../shared/ui/hlm/hlm-spinner.component';
import { KlarInputComponent } from '../../shared/ui/klar-input.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { HouseholdStore } from '../../core/household/household.store';
import type { InvitationLink } from '@klar/shared';

@Component({
  selector: 'app-invite-dialog',
  standalone: true,
  imports: [FormsModule, HlmButtonDirective, HlmSpinnerComponent, KlarInputComponent, KlarIconComponent],
  template: `
    <div class="flex flex-col gap-6 p-1">
      @if (loading()) {
        <div class="flex justify-center py-8">
          <hlm-spinner />
        </div>
      } @else {
        <!-- Email senden -->
        <div class="flex flex-col gap-2">
          <p class="text-[10px] uppercase tracking-widest text-muted-foreground">Per E-Mail einladen</p>
          <div class="flex gap-2">
            <klar-input
              class="flex-1"
              type="email"
              placeholder="email@beispiel.de"
              [ngModel]="emailInput()"
              (ngModelChange)="emailInput.set($event)"
              [disabled]="sendingEmail()"
            />
            <button
              hlmBtn
              variant="default"
              [disabled]="!emailInput().trim() || sendingEmail()"
              (click)="sendEmail()"
              class="shrink-0 min-h-[44px]"
            >
              @if (sendingEmail()) { <hlm-spinner size="sm" /> } @else { Senden }
            </button>
          </div>
          <p class="text-xs text-muted-foreground">Empfänger erhält den Einladungslink per E-Mail</p>
        </div>

        <!-- Divider -->
        <div class="flex items-center gap-3 text-muted-foreground text-xs">
          <div class="flex-1 h-px bg-border"></div>
          oder Link direkt teilen
          <div class="flex-1 h-px bg-border"></div>
        </div>

        <!-- Link teilen -->
        <div class="flex flex-col gap-2">
          <p class="text-[10px] uppercase tracking-widest text-muted-foreground">Einladungslink</p>
          @if (invite()) {
            <div class="flex gap-2">
              <input
                class="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-xs text-muted-foreground font-mono truncate min-h-[44px]"
                [value]="invite()!.link"
                readonly
              />
              <button hlmBtn variant="outline" (click)="copyLink()" class="shrink-0 min-w-[44px] min-h-[44px]">
                <klar-icon name="copy" [size]="16" />
              </button>
            </div>
            <div class="flex gap-2">
              <button hlmBtn variant="secondary" class="flex-1 min-h-[44px]" (click)="shareLink()">
                <klar-icon name="share-2" [size]="16" class="mr-2" />
                Teilen
              </button>
              <button hlmBtn variant="secondary" class="flex-1 min-h-[44px]" [disabled]="regenerating()" (click)="regenerate()">
                @if (regenerating()) {
                  <hlm-spinner size="sm" class="mr-2" />
                } @else {
                  <klar-icon name="refresh-cw" [size]="16" class="mr-2" />
                }
                Neu generieren
              </button>
            </div>
            <p class="text-xs text-muted-foreground">
              Einmalig verwendbar
              @if (invite()!.expiresAt) {
                · Gültig bis {{ formatDate(invite()!.expiresAt!) }}
              }
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class InviteDialogComponent implements OnInit {
  private store = inject(HouseholdStore);
  private toast = inject(KlarToastService);

  readonly invite = signal<InvitationLink | null>(null);
  readonly loading = signal(true);
  readonly emailInput = signal('');
  readonly sendingEmail = signal(false);
  readonly regenerating = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const link = await this.store.createInvite({ expiresInDays: 7 });
      this.invite.set(link);
    } catch {
      this.toast.error('Einladungslink konnte nicht erstellt werden');
    } finally {
      this.loading.set(false);
    }
  }

  async sendEmail(): Promise<void> {
    const email = this.emailInput().trim();
    const link = this.invite();
    if (!email || !link) return;
    this.sendingEmail.set(true);
    try {
      await this.store.sendInviteEmail(link.id, email);
      this.toast.success(`Einladung an ${email} gesendet`);
      this.emailInput.set('');
    } catch {
      this.toast.error('E-Mail konnte nicht gesendet werden');
    } finally {
      this.sendingEmail.set(false);
    }
  }

  async copyLink(): Promise<void> {
    const link = this.invite()?.link;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.toast.success('Link kopiert');
    } catch {
      this.toast.error('Kopieren fehlgeschlagen');
    }
  }

  async shareLink(): Promise<void> {
    const link = this.invite()?.link;
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Klar — Haushalt beitreten', url: link });
      } catch {
        // user cancelled — fallback to copy
        await this.copyLink();
      }
    } else {
      await this.copyLink();
    }
  }

  async regenerate(): Promise<void> {
    const old = this.invite();
    this.regenerating.set(true);
    try {
      if (old) await this.store.deleteInvite(old.id);
      const link = await this.store.createInvite({ expiresInDays: 7 });
      this.invite.set(link);
      this.toast.success('Neuer Einladungslink erstellt');
    } catch {
      this.toast.error('Link konnte nicht neu generiert werden');
    } finally {
      this.regenerating.set(false);
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
