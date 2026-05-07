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

// Bare names (e.g. seed `home`, `briefcase`) default to lucide.
function normalizeIconKey(key: string): string {
  return key.includes(':') ? key : `lucide:${key}`;
}

function colorForKey(key: string): string | null {
  if (key.startsWith('simple-icons:')) {
    return BRAND_COLORS[key.slice('simple-icons:'.length)] ?? null;
  }
  return null; // lucide etc. inherit currentColor
}

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
  name          = input.required<string>();
  size          = input(14);
  color         = input<string | null>(null);
  icon          = input<string | null>(null);
  fallbackIcon  = input<string | null>(null);
  fallbackColor = input<string | null>(null);

  // Auto-detect brand slug from name (only when no per-row icon override)
  readonly slug = computed(() => {
    if (this.icon()) return null;
    const lower = this.name().toLowerCase();
    for (const [keyword, slug] of BRAND_MAP) {
      if (lower.includes(keyword)) return slug;
    }
    return null;
  });

  // Priority: explicit per-row icon > name-based brand match > fallback (category)
  readonly iconKey = computed(() => {
    const explicit = this.icon();
    if (explicit) return normalizeIconKey(explicit);
    const s = this.slug();
    if (s) return `simple-icons:${s}`;
    const fb = this.fallbackIcon();
    return fb ? normalizeIconKey(fb) : null;
  });

  readonly effectiveColor = computed(() => {
    const explicit = this.color();
    if (explicit) return explicit;

    const ei = this.icon();
    if (ei) return colorForKey(normalizeIconKey(ei));

    const s = this.slug();
    if (s) return BRAND_COLORS[s] ?? null;

    return this.fallbackColor() ?? null;
  });
}
