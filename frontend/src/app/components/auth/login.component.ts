import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="min-h-[70vh] flex items-center justify-center">
      <div class="glass p-10 max-w-md w-full text-center animate-scale-in">
        <div class="text-6xl mb-6">💰</div>
        <h1 class="text-3xl font-bold mb-2"
            style="background: linear-gradient(135deg, #6366f1, #10b981);
                   -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          Denaro
        </h1>
        <p class="mb-8" style="color: var(--text-secondary);">
          Track your budgets, manage expenses, and stay on top of your finances.
        </p>
        <button (click)="login()" class="glass-btn glass-btn-primary w-full text-lg py-3">
          Sign in with OIDC
        </button>
        <p class="mt-6 text-xs" style="color: var(--text-muted);">
          Secure authentication via your identity provider
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent {
  constructor(private auth: AuthService) {}

  async login() {
    await this.auth.login();
  }
}
