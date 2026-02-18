import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-callback',
  standalone: true,
  template: `
    <div class="min-h-[70vh] flex items-center justify-center">
      <div class="glass p-10 text-center animate-scale-in">
        <div class="text-4xl mb-4 animate-pulse">🔐</div>
        <p style="color: var(--text-secondary);">Completing sign-in...</p>
      </div>
    </div>
  `,
})
export class CallbackComponent implements OnInit {
  constructor(private auth: AuthService, private router: Router) {}

  async ngOnInit() {
    try {
      await this.auth.handleCallback();
      this.router.navigate(['/dashboard']);
    } catch (err) {
      console.error('Auth callback failed:', err);
      this.router.navigate(['/auth/login']);
    }
  }
}
