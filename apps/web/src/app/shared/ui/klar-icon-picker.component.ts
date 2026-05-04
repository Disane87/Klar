import { Component, computed, model, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import 'iconify-icon';

type IconTab = 'brands' | 'lucide';

interface IconOption {
  key: string;
  label: string;
}

export const BRAND_OPTIONS: IconOption[] = [
  { key: 'simple-icons:spotify',    label: 'Spotify' },
  { key: 'simple-icons:netflix',    label: 'Netflix' },
  { key: 'simple-icons:youtube',    label: 'YouTube' },
  { key: 'simple-icons:twitch',     label: 'Twitch' },
  { key: 'simple-icons:github',     label: 'GitHub' },
  { key: 'simple-icons:anthropic',  label: 'Anthropic' },
  { key: 'simple-icons:openai',     label: 'OpenAI' },
  { key: 'simple-icons:adobe',      label: 'Adobe' },
  { key: 'simple-icons:figma',      label: 'Figma' },
  { key: 'simple-icons:notion',     label: 'Notion' },
  { key: 'simple-icons:slack',      label: 'Slack' },
  { key: 'simple-icons:discord',    label: 'Discord' },
  { key: 'simple-icons:zoom',       label: 'Zoom' },
  { key: 'simple-icons:dropbox',    label: 'Dropbox' },
  { key: 'simple-icons:google',     label: 'Google' },
  { key: 'simple-icons:microsoft',  label: 'Microsoft' },
  { key: 'simple-icons:apple',      label: 'Apple' },
  { key: 'simple-icons:amazon',     label: 'Amazon' },
  { key: 'simple-icons:paypal',     label: 'PayPal' },
  { key: 'simple-icons:klarna',     label: 'Klarna' },
  { key: 'simple-icons:vodafone',   label: 'Vodafone' },
  { key: 'simple-icons:linkedin',   label: 'LinkedIn' },
  { key: 'simple-icons:hetzner',    label: 'Hetzner' },
];

export const LUCIDE_OPTIONS: IconOption[] = [
  // Wohnen & Versorger
  { key: 'lucide:home',          label: 'Wohnen' },
  { key: 'lucide:building',      label: 'Gebäude' },
  { key: 'lucide:zap',           label: 'Strom' },
  { key: 'lucide:droplets',      label: 'Wasser' },
  { key: 'lucide:flame',         label: 'Gas/Heizung' },
  { key: 'lucide:wifi',          label: 'Internet' },
  { key: 'lucide:trash-2',       label: 'Müll' },
  { key: 'lucide:sun',           label: 'Solar' },
  // Mobilität
  { key: 'lucide:car',           label: 'Auto' },
  { key: 'lucide:train',         label: 'ÖPNV' },
  { key: 'lucide:plane',         label: 'Reisen' },
  { key: 'lucide:bike',          label: 'Fahrrad' },
  // Kommunikation & Tech
  { key: 'lucide:smartphone',    label: 'Handy' },
  { key: 'lucide:tv',            label: 'TV' },
  { key: 'lucide:monitor',       label: 'PC/Laptop' },
  { key: 'lucide:headphones',    label: 'Audio' },
  { key: 'lucide:camera',        label: 'Foto' },
  // Einkauf & Lifestyle
  { key: 'lucide:shopping-cart', label: 'Einkauf' },
  { key: 'lucide:coffee',        label: 'Café' },
  { key: 'lucide:utensils',      label: 'Restaurant' },
  { key: 'lucide:shirt',         label: 'Kleidung' },
  { key: 'lucide:scissors',      label: 'Friseur' },
  // Gesundheit & Sport
  { key: 'lucide:heart-pulse',   label: 'Gesundheit' },
  { key: 'lucide:dumbbell',      label: 'Fitness' },
  { key: 'lucide:stethoscope',   label: 'Arzt' },
  { key: 'lucide:pill',          label: 'Apotheke' },
  // Bildung & Arbeit
  { key: 'lucide:book-open',     label: 'Bücher' },
  { key: 'lucide:graduation-cap', label: 'Bildung' },
  { key: 'lucide:briefcase',     label: 'Arbeit' },
  // Familie & Freizeit
  { key: 'lucide:baby',          label: 'Kind' },
  { key: 'lucide:dog',           label: 'Haustier' },
  { key: 'lucide:music',         label: 'Musik' },
  { key: 'lucide:gamepad-2',     label: 'Gaming' },
  { key: 'lucide:trees',         label: 'Garten' },
  // Finanzen
  { key: 'lucide:piggy-bank',    label: 'Sparen' },
  { key: 'lucide:credit-card',   label: 'Kreditkarte' },
  { key: 'lucide:banknote',      label: 'Bargeld' },
  { key: 'lucide:receipt',       label: 'Rechnung' },
  { key: 'lucide:wrench',        label: 'Reparatur' },
  { key: 'lucide:newspaper',     label: 'Zeitung' },
];

@Component({
  selector: 'klar-icon-picker',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <!-- Tab bar -->
    <div class="flex border-b border-(--border) mb-2">
      <button type="button"
              class="text-[11px] font-medium px-3 py-1.5 border-b-2 -mb-px transition-colors"
              [class.border-(--color-accent)]="tab() === 'brands'"
              [class.text-(--text)]="tab() === 'brands'"
              [class.border-transparent]="tab() !== 'brands'"
              [class.text-(--text-muted)]="tab() !== 'brands'"
              (click)="tab.set('brands')">Marken</button>
      <button type="button"
              class="text-[11px] font-medium px-3 py-1.5 border-b-2 -mb-px transition-colors"
              [class.border-(--color-accent)]="tab() === 'lucide'"
              [class.text-(--text)]="tab() === 'lucide'"
              [class.border-transparent]="tab() !== 'lucide'"
              [class.text-(--text-muted)]="tab() !== 'lucide'"
              (click)="tab.set('lucide')">Symbole</button>
    </div>

    <!-- Icon grid -->
    <div class="flex flex-wrap gap-1 max-h-44 overflow-y-auto pr-1">
      <!-- Auto / none option -->
      <button type="button"
              class="w-9 h-9 rounded-md border-2 flex items-center justify-center text-[9px] font-semibold transition-all"
              [class.border-(--color-accent)]="value() === null"
              [class.bg-(--color-accent)/10]="value() === null"
              [class.text-(--color-accent)]="value() === null"
              [class.border-(--border)]="value() !== null"
              [class.text-(--text-muted)]="value() !== null"
              (click)="value.set(null)"
              title="Automatisch">Auto</button>

      @for (opt of currentOptions(); track opt.key) {
        <button type="button"
                class="w-9 h-9 rounded-md border-2 flex items-center justify-center transition-all"
                [class.border-(--color-accent)]="value() === opt.key"
                [class.bg-(--color-accent)/10]="value() === opt.key"
                [class.border-(--border)]="value() !== opt.key"
                [title]="opt.label"
                (click)="value.set(value() === opt.key ? null : opt.key)">
          <iconify-icon [icon]="opt.key" width="18" height="18"
                        class="block text-(--text)" />
        </button>
      }
    </div>
  `,
})
export class KlarIconPickerComponent {
  value = model<string | null>(null);
  readonly tab = signal<IconTab>('brands');

  readonly currentOptions = computed(() =>
    this.tab() === 'brands' ? BRAND_OPTIONS : LUCIDE_OPTIONS
  );
}
