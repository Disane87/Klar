import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { KlarTileComponent } from '../../shared/ui/klar-tile.component';
import { KlarProgressRingComponent } from '../../shared/ui/klar-progress-ring.component';
import { KlarConfidenceBarComponent } from '../../shared/ui/klar-confidence-bar.component';
import { KlarHypoChipComponent } from '../../shared/ui/klar-hypo-chip.component';

/**
 * /app/spec — admin-only dev gallery rendering every Klar Design Pearl
 * primitive (buttons × tones × variants × sizes, chips, inputs, cards,
 * setting rows, profile card, metric tiles, progress rings, confidence bars,
 * hypo chips, animations, type scale).
 *
 * Read-only reference; not wired to data.
 */
@Component({
  selector: 'klar-spec-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    KlarTileComponent,
    KlarProgressRingComponent,
    KlarConfidenceBarComponent,
    KlarHypoChipComponent,
  ],
  template: `
    <div class="flex flex-col gap-(--s-6) p-(--s-6) max-w-350 mx-auto">

      <!-- Buttons -->
      <div>
        <div class="section-head">Buttons</div>
        <div class="card flex flex-col gap-(--s-5) p-(--s-5)">

          <div class="flex flex-col gap-2">
            <div class="eyebrow">Soft (default)</div>
            <div class="flex flex-wrap gap-2">
              <button class="btn">Default</button>
              <button class="btn primary">Primary</button>
              <button class="btn danger">Danger</button>
              <button class="btn success">Success</button>
              <button class="btn warn">Warn</button>
              <button class="btn ghost">Ghost</button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <div class="eyebrow">Solid</div>
            <div class="flex flex-wrap gap-2">
              <button class="btn primary solid">Primary</button>
              <button class="btn danger solid">Danger</button>
              <button class="btn success solid">Success</button>
              <button class="btn warn solid">Warn</button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <div class="eyebrow">Sizes</div>
            <div class="flex flex-wrap items-center gap-2">
              <button class="btn primary lg">Large</button>
              <button class="btn primary">Default</button>
              <button class="btn primary sm">Small</button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <div class="eyebrow">Icon-only</div>
            <div class="flex flex-wrap gap-2">
              <button class="btn icon-only" aria-label="Plus">+</button>
              <button class="btn primary icon-only" aria-label="Edit">✎</button>
              <button class="btn danger icon-only" aria-label="Delete">×</button>
              <button class="btn ghost icon-only" aria-label="More">⋯</button>
            </div>
          </div>

        </div>
      </div>

      <!-- Chips -->
      <div>
        <div class="section-head">Chips</div>
        <div class="card flex flex-wrap gap-2 p-(--s-5)">
          <span class="chip">Default</span>
          <span class="chip success">Success</span>
          <span class="chip danger">Danger</span>
          <span class="chip warn">Warn</span>
          <span class="chip outline">Outline</span>
          <span class="chip dot">Dot · running</span>
          <span class="chip success dot">Success dot</span>
          <span class="chip danger dot">Danger dot</span>
        </div>
      </div>

      <!-- Inputs -->
      <div>
        <div class="section-head">Inputs</div>
        <div class="card grid grid-cols-1 md:grid-cols-2 gap-(--s-5) p-(--s-5)">

          <div class="flex flex-col gap-1.5">
            <label class="field-label">Standard input</label>
            <input class="input" type="text" placeholder="z. B. Müller GmbH" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="field-label">Mono input</label>
            <input class="input mono" type="text" value="bgb_live_4f8a91e2…" readonly />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="field-label">Money input (positive)</label>
            <div class="money-input">
              <span class="sign">+</span>
              <input type="text" inputmode="decimal" value="1.234,56" />
              <span class="sign">€</span>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="field-label">Money input (negative)</label>
            <div class="money-input">
              <span class="sign">−</span>
              <input type="text" inputmode="decimal" value="89,90" />
              <span class="sign">€</span>
            </div>
          </div>

        </div>
      </div>

      <!-- Cards & Rows -->
      <div>
        <div class="section-head">Cards & Rows</div>
        <div class="card p-0">
          <div class="card-header">
            <span class="h-eyebrow">Mai 2026</span>
            <span class="h-title">Wohnen</span>
            <span class="h-count">3</span>
          </div>
          <div class="row">
            <div class="row-ico-slot">●</div>
            <div class="lhs">
              <div class="name">Miete</div>
              <div class="meta">Monatlich · 1. d. M.</div>
            </div>
            <div class="amt neg">−1.250,00 €</div>
          </div>
          <div class="row">
            <div class="row-ico-slot">●</div>
            <div class="lhs">
              <div class="name">Strom</div>
              <div class="meta">Monatlich · 5. d. M.</div>
            </div>
            <div class="amt neg">−85,00 €</div>
          </div>
          <div class="row sub">
            <div class="lhs">
              <div class="name">+ weitere Position</div>
            </div>
          </div>
          <div class="row subtotal">
            <div class="lhs">
              <div class="name">Wohnen Σ</div>
            </div>
            <div class="amt neg">−1.335,00 €</div>
          </div>
        </div>
      </div>

      <!-- Setting rows -->
      <div>
        <div class="section-head">Setting Rows</div>
        <div class="card p-0">
          <div class="setting-row">
            <div class="setting-icon">●</div>
            <div class="setting-text">
              <div class="setting-label">Sprache</div>
              <div class="setting-sub">Anzeige-Sprache der App</div>
            </div>
            <div class="setting-rhs"><span class="chip outline">Deutsch</span></div>
          </div>
          <div class="setting-row interactive">
            <div class="setting-icon">●</div>
            <div class="setting-text">
              <div class="setting-label">Theme</div>
              <div class="setting-sub">System · hell · dunkel</div>
            </div>
            <div class="setting-rhs"><span class="chip">System</span></div>
          </div>
          <div class="setting-row danger last">
            <div class="setting-icon">●</div>
            <div class="setting-text">
              <div class="setting-label">Konto löschen</div>
              <div class="setting-sub">Unwiederbringlich</div>
            </div>
            <div class="setting-rhs"><button class="btn ghost danger sm">Löschen</button></div>
          </div>
        </div>
      </div>

      <!-- Profile card -->
      <div>
        <div class="section-head">Profile Card</div>
        <div class="profile-card profile-grid">
          <div class="rounded-full bg-(--bg-2) flex items-center justify-center text-(--fg-2)"
               style="width: 96px; height: 96px;">MF</div>
          <div class="flex flex-col gap-1.5">
            <div class="serif text-[24px] leading-none">Marco Franke</div>
            <div class="text-[12px] text-(--fg-2)">marco&#64;example.com</div>
            <div class="flex flex-wrap gap-1.5 mt-1">
              <span class="chip success dot">verifiziert</span>
              <span class="chip outline">ADMIN</span>
              <span class="chip">Mitglied seit 2026</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Metric tile + ring + bar + hypo -->
      <div>
        <div class="section-head">Metric Tile · Progress Ring · Confidence · Hypo</div>
        <div class="card grid grid-cols-1 md:grid-cols-2 gap-(--s-5) p-(--s-5) items-start">

          <klar-tile label="Überschuss · Mai" value="+1.234,56 €" sub="vs. April" tone="success" valueClass="text-(--success)" />

          <div class="flex items-center gap-(--s-4)">
            <klar-progress-ring [value]="0.62" [size]="56" [stroke]="5" [showValue]="true" tone="var(--cat-freizeit)" />
            <div class="flex flex-col gap-0.5">
              <div class="serif text-[20px] leading-none">Projekt Bali</div>
              <div class="text-[12px] text-(--fg-2)">62% gespart</div>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="field-label">Vertragserkennung · Confidence</div>
            <klar-confidence-bar [value]="0.92" />
            <klar-confidence-bar [value]="0.65" />
            <klar-confidence-bar [value]="0.32" />
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="field-label">Hypo-Chip (Planspiel)</div>
            <div class="flex flex-wrap gap-2">
              <klar-hypo-chip />
              <klar-hypo-chip label="What-if" />
            </div>
          </div>

        </div>
      </div>

      <!-- Animations -->
      <div>
        <div class="section-head">Animations</div>
        <div class="card flex flex-wrap items-center gap-(--s-4) p-(--s-5)">
          <button class="btn primary" (click)="popKey.set(popKey() + 1)">Trigger .klar-pop</button>
          <span class="chip success" [class.klar-pop]="popKey() > 0" [attr.data-key]="popKey()">+1.234,56 €</span>

          <button class="btn primary solid" (click)="popCenterKey.set(popCenterKey() + 1)">Trigger .klar-pop-center</button>
          <div class="serif text-[28px]"
               [class.klar-pop-center]="popCenterKey() > 0"
               [attr.data-key]="popCenterKey()">+1.234</div>
        </div>
      </div>

      <!-- Type scale -->
      <div>
        <div class="section-head">Type Scale</div>
        <div class="card flex flex-col gap-(--s-4) p-(--s-5)">
          <div class="eyebrow">Eyebrow · 10 px · uppercase · 0.14em</div>
          <div class="serif text-[28px] leading-none">Serif headline · Fraunces · -0.02em</div>
          <div class="mono text-[13px]">.mono · JetBrains Mono · tabular-nums · 1.234,56 €</div>

          <div class="grid grid-cols-7 gap-(--s-3) mt-2">
            @for (sz of fontSizes; track sz) {
              <div class="flex flex-col items-center gap-1">
                <div class="serif tabular-nums leading-none" [style.fontSize.px]="sz">12,34</div>
                <div class="eyebrow">{{ sz }} px</div>
              </div>
            }
          </div>
        </div>
      </div>

    </div>
  `,
})
export class SpecPageComponent implements OnInit {
  private header = inject(PageHeaderService);

  protected readonly popKey = signal(0);
  protected readonly popCenterKey = signal(0);
  protected readonly fontSizes = [10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 40, 56];

  ngOnInit(): void {
    this.header.set({
      title: 'Komponenten-Spec',
      subtitle: 'Design-Primitives der Klar Design Pearl',
    });
  }
}
