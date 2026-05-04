import { Component, input, computed, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import 'iconify-icon';
import { KlarIconComponent } from '../icons/klar-icon.component';

const BRAND_MAP: [string, string][] = [
  ['spotify',    'spotify'],
  ['netflix',    'netflix'],
  ['github',     'github'],
  ['claude',     'anthropic'],
  ['anthropic',  'anthropic'],
  ['chatgpt',    'openai'],
  ['openai',     'openai'],
  ['vodafone',   'vodafone'],
  ['icloud',     'apple'],
  ['apple',      'apple'],
  ['hetzner',    'hetzner'],
  ['linkedin',   'linkedin'],
  ['microsoft',  'microsoft'],
  ['google',     'google'],
  ['amazon',     'amazon'],
  ['discord',    'discord'],
  ['slack',      'slack'],
  ['notion',     'notion'],
  ['figma',      'figma'],
  ['paypal',     'paypal'],
  ['klarna',     'klarna'],
];

export const BRAND_COLORS: Record<string, string> = {
  spotify:    '#1DB954',
  netflix:    '#E50914',
  github:     '#6e5494',
  anthropic:  '#E87040',
  openai:     '#10A37F',
  vodafone:   '#E60000',
  apple:      '#888888',
  hetzner:    '#D50C2D',
  linkedin:   '#0A66C2',
  microsoft:  '#00A4EF',
  google:     '#4285F4',
  amazon:     '#FF9900',
  discord:    '#5865F2',
  slack:      '#4A154B',
  notion:     '#000000',
  figma:      '#F24E1E',
  paypal:     '#0070BA',
  klarna:     '#FF6CAE',
  youtube:    '#FF0000',
  twitch:     '#9146FF',
  adobe:      '#FF0000',
  dropbox:    '#0061FF',
  zoom:       '#2D8CFF',
};

@Component({
  selector: 'app-brand-icon',
  standalone: true,
  host: { class: 'inline-flex items-center justify-center shrink-0' },
  imports: [KlarIconComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './brand-icon.component.html',
  styleUrl: './brand-icon.component.css',
})
export class BrandIconComponent {
  name  = input.required<string>();
  size  = input(14);
  color = input<string | null>(null);
  icon  = input<string | null>(null);

  // Auto-detect brand slug from name (used when no explicit icon)
  readonly slug = computed(() => {
    if (this.icon()) return null; // explicit icon set, skip auto-detect
    const lower = this.name().toLowerCase();
    for (const [keyword, slug] of BRAND_MAP) {
      if (lower.includes(keyword)) return slug;
    }
    return null;
  });

  // Effective icon key to render
  readonly iconKey = computed(() => {
    const explicit = this.icon();
    if (explicit) return explicit;
    const s = this.slug();
    return s ? `simple-icons:${s}` : null;
  });

  readonly effectiveColor = computed(() => {
    const explicit = this.color();
    if (explicit) return explicit;

    const ei = this.icon();
    if (ei?.startsWith('simple-icons:')) {
      const slug = ei.replace('simple-icons:', '');
      return BRAND_COLORS[slug] ?? null;
    }
    if (ei?.startsWith('lucide:')) return null;

    const s = this.slug();
    return s ? (BRAND_COLORS[s] ?? null) : null;
  });
}
