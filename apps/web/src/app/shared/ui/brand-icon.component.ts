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

@Component({
  selector: 'app-brand-icon',
  standalone: true,
  host: { class: 'inline-flex items-center justify-center shrink-0 text-(--text-muted)' },
  imports: [KlarIconComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './brand-icon.component.html',
  styleUrl: './brand-icon.component.css',
})
export class BrandIconComponent {
  name = input.required<string>();
  size = input(14);

  readonly slug = computed(() => {
    const lower = this.name().toLowerCase();
    for (const [keyword, slug] of BRAND_MAP) {
      if (lower.includes(keyword)) return slug;
    }
    return null;
  });
}
