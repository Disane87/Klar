import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'klar-logo-mark',
  standalone: true,
  host: { class: 'inline-flex items-center' },
  templateUrl: './klar-logo-mark.component.html',
  styleUrl: './klar-logo-mark.component.css',
})
export class KlarLogoMarkComponent {
  variant = input<'ledger' | 'diamond'>('ledger');
  size    = input(36);
  color   = input<string | null>(null);

  // Stable gradient ID per component instance (avoids SVG ID collisions)
  readonly gradId = computed(() => `klar-lg-${this.size()}`);

  readonly gradStart = computed(() => this.color() ?? '#ffffff');
  readonly gradEnd   = computed(() => this.color() ? this.color()! : '#c7d2fe');

  // When a custom color is passed use it flat; otherwise use the gradient ref
  readonly fill = computed(() =>
    this.color() ? this.color()! : `url(#${this.gradId()})`
  );
}
