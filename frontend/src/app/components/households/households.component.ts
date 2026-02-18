import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HouseholdService } from '../../services/household.service';
import { Household } from '../../models/household.model';

@Component({
  selector: 'app-households',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="space-y-6 stagger-children">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold" style="color: var(--text-primary);">Family & Households</h1>
          <p style="color: var(--text-secondary);">Share budgets with your family</p>
        </div>
        <div class="flex gap-2">
          <button (click)="showJoin.set(true); showCreate.set(false)" class="glass-btn">
            Join
          </button>
          <button (click)="showCreate.set(true); showJoin.set(false)" class="glass-btn glass-btn-primary">
            + Create
          </button>
        </div>
      </div>

      <!-- Create form -->
      @if (showCreate()) {
        <div class="glass p-6 animate-scale-in">
          <h2 class="text-lg font-semibold mb-4">Create Household</h2>
          <div class="flex gap-3">
            <input [(ngModel)]="newName" class="glass-input flex-1" placeholder="Family name" />
            <button (click)="create()" class="glass-btn glass-btn-primary">Create</button>
          </div>
        </div>
      }

      <!-- Join form -->
      @if (showJoin()) {
        <div class="glass p-6 animate-scale-in">
          <h2 class="text-lg font-semibold mb-4">Join Household</h2>
          <div class="flex gap-3">
            <input [(ngModel)]="inviteCode" class="glass-input flex-1" placeholder="Enter invite code" />
            <button (click)="join()" class="glass-btn glass-btn-primary">Join</button>
          </div>
        </div>
      }

      <!-- Households grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
        @for (h of households(); track h.id) {
          <a [routerLink]="['/households', h.id]"
             class="glass p-6 block group cursor-pointer">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600
                          flex items-center justify-center text-white text-2xl
                          transition-transform group-hover:scale-110 duration-300">
                👨‍👩‍👧‍👦
              </div>
              <div>
                <h3 class="text-lg font-semibold" style="color: var(--text-primary);">{{ h.name }}</h3>
                <p class="text-sm" style="color: var(--text-muted);">
                  Invite code: <code class="bg-white/10 px-2 py-0.5 rounded">{{ h.inviteCode }}</code>
                </p>
              </div>
            </div>
          </a>
        } @empty {
          <div class="glass p-8 text-center col-span-full" style="color: var(--text-muted);">
            <p class="text-5xl mb-3">👨‍👩‍👧‍👦</p>
            <p class="text-lg mb-2">No households yet</p>
            <p class="text-sm">Create one to start sharing budgets with your family!</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class HouseholdsComponent implements OnInit {
  households = signal<Household[]>([]);
  showCreate = signal(false);
  showJoin = signal(false);
  newName = '';
  inviteCode = '';

  constructor(private householdService: HouseholdService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.householdService.getAll().subscribe((data) => this.households.set(data));
  }

  create() {
    if (!this.newName.trim()) return;
    this.householdService.create(this.newName).subscribe(() => {
      this.showCreate.set(false);
      this.newName = '';
      this.load();
    });
  }

  join() {
    if (!this.inviteCode.trim()) return;
    this.householdService.join(this.inviteCode).subscribe(() => {
      this.showJoin.set(false);
      this.inviteCode = '';
      this.load();
    });
  }
}
