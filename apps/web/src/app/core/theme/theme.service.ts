import { Injectable, signal, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'klar-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private document = inject(DOCUMENT);

  readonly theme = signal<Theme>(this.loadFromStorage());

  constructor() {
    effect(() => {
      this.applyTheme(this.theme());
      localStorage.setItem(STORAGE_KEY, this.theme());
    });
  }

  set(theme: Theme): void {
    this.theme.set(theme);
  }

  private loadFromStorage(): Theme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {
      // SSR guard
    }
    return 'dark';
  }

  private applyTheme(theme: Theme): void {
    const el = this.document.documentElement;
    el.classList.remove('light', 'dark');
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      el.classList.add(prefersDark ? 'dark' : 'light');
    } else {
      el.classList.add(theme);
    }
  }
}
