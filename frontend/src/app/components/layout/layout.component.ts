import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <!-- Top navigation bar -->
    <nav class="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10"
         style="border-radius: 0 0 20px 20px;">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <a routerLink="/dashboard" class="flex items-center gap-2 group">
            <span class="text-2xl transition-transform group-hover:scale-110 duration-300">💰</span>
            <span class="text-xl font-bold bg-gradient-to-r from-indigo-500 to-emerald-500 bg-clip-text text-transparent">
              Denaro
            </span>
          </a>

          <!-- Desktop nav -->
          <div class="hidden md:flex items-center gap-1">
            @for (item of navItems; track item.path) {
              <a [routerLink]="item.path"
                 routerLinkActive="!bg-indigo-500/20 !text-indigo-400 !border-indigo-500/30"
                 class="glass-btn text-sm flex items-center gap-2 border border-transparent">
                <span>{{ item.icon }}</span>
                <span>{{ item.label }}</span>
              </a>
            }
          </div>

          <!-- User menu -->
          <div class="flex items-center gap-3">
            @if (auth.isAuthenticated()) {
              <div class="flex items-center gap-2">
                @if (auth.user()?.avatarUrl) {
                  <img [src]="auth.user()!.avatarUrl!" alt="Avatar"
                       class="w-8 h-8 rounded-full ring-2 ring-indigo-500/30" />
                } @else {
                  <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500
                              flex items-center justify-center text-white text-sm font-bold">
                    {{ auth.user()?.displayName?.charAt(0) || '?' }}
                  </div>
                }
                <span class="hidden sm:inline text-sm font-medium"
                      style="color: var(--text-secondary);">
                  {{ auth.user()?.displayName }}
                </span>
              </div>
              <button (click)="auth.logout()" class="glass-btn text-sm">
                Logout
              </button>
            }
          </div>

          <!-- Mobile menu toggle -->
          <button (click)="mobileMenuOpen.set(!mobileMenuOpen())"
                  class="md:hidden glass-btn p-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              @if (mobileMenuOpen()) {
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              } @else {
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile nav -->
      @if (mobileMenuOpen()) {
        <div class="md:hidden p-4 stagger-children">
          @for (item of navItems; track item.path) {
            <a [routerLink]="item.path"
               routerLinkActive="!bg-indigo-500/20"
               (click)="mobileMenuOpen.set(false)"
               class="block glass-btn mb-2 text-sm">
              <span>{{ item.icon }}</span>
              <span class="ml-2">{{ item.label }}</span>
            </a>
          }
        </div>
      }
    </nav>

    <!-- Main content -->
    <main class="pt-24 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen">
      <ng-content />
    </main>
  `,
})
export class LayoutComponent {
  mobileMenuOpen = signal(false);

  navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/budgets', label: 'Budgets', icon: '💳' },
    { path: '/incomes', label: 'Incomes', icon: '💵' },
    { path: '/categories', label: 'Categories', icon: '🏷️' },
    { path: '/households', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  ];

  constructor(public auth: AuthService) {}
}
