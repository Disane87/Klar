import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HouseholdService } from '../../services/household.service';
import { AuthService } from '../../services/auth.service';
import {
  Household,
  HouseholdMember,
  HouseholdSummary,
} from '../../models/household.model';

@Component({
  selector: 'app-household-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6 stagger-children">
      @if (household()) {
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold" style="color: var(--text-primary);">
              {{ household()!.name }}
            </h1>
            <p style="color: var(--text-secondary);">
              Invite code:
              <code class="bg-white/10 px-2 py-1 rounded text-indigo-400 font-mono">
                {{ household()!.inviteCode }}
              </code>
            </p>
          </div>
        </div>

        <!-- Summary cards -->
        @if (summary()) {
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="glass p-6">
              <p class="text-sm" style="color: var(--text-secondary);">Combined Income</p>
              <p class="text-2xl font-bold text-emerald-500 mt-1">
                {{ formatCurrency(summary()!.totalIncome) }}
              </p>
            </div>
            <div class="glass p-6">
              <p class="text-sm" style="color: var(--text-secondary);">Combined Expenses</p>
              <p class="text-2xl font-bold text-red-400 mt-1">
                {{ formatCurrency(summary()!.totalExpenses) }}
              </p>
            </div>
            <div class="glass p-6">
              <p class="text-sm" style="color: var(--text-secondary);">Remaining</p>
              <p class="text-2xl font-bold mt-1"
                 [class]="summary()!.remaining >= 0 ? 'text-indigo-500' : 'text-red-500'">
                {{ formatCurrency(summary()!.remaining) }}
              </p>
            </div>
          </div>

          <!-- Per-member breakdown -->
          <div class="glass p-6">
            <h2 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">
              Member Contributions
            </h2>
            <div class="space-y-4">
              @for (member of summary()!.members; track member.userId) {
                <div class="glass p-4">
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500
                                  flex items-center justify-center text-white text-sm font-bold">
                        {{ member.displayName.charAt(0) }}
                      </div>
                      <div>
                        <p class="font-medium" style="color: var(--text-primary);">{{ member.displayName }}</p>
                        <span class="text-xs px-2 py-0.5 rounded-full"
                              [class]="member.role === 'ADMIN'
                                ? 'bg-indigo-500/20 text-indigo-400'
                                : member.role === 'MEMBER'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-gray-500/20 text-gray-400'">
                          {{ member.role }}
                        </span>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="text-sm text-emerald-500 font-medium">
                        +{{ formatCurrency(member.totalIncome) }}
                      </p>
                      <p class="text-sm text-red-400 font-medium">
                        -{{ formatCurrency(member.totalExpenses) }}
                      </p>
                    </div>
                  </div>
                  <!-- Member contribution bar -->
                  <div class="flex gap-1">
                    <div class="h-2 rounded-full bg-emerald-500/50 transition-all duration-700"
                         [style.width.%]="memberIncomeShare(member.totalIncome)">
                    </div>
                    <div class="h-2 rounded-full bg-red-400/50 transition-all duration-700"
                         [style.width.%]="memberExpenseShare(member.totalExpenses)">
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Members list -->
        <div class="glass p-6">
          <h2 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">Members</h2>
          <div class="space-y-3">
            @for (member of members(); track member.userId) {
              <div class="flex items-center justify-between p-3 rounded-xl"
                   style="background: var(--glass-bg);">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500
                              flex items-center justify-center text-white text-xs font-bold">
                    {{ member.user?.displayName?.charAt(0) || '?' }}
                  </div>
                  <span style="color: var(--text-primary);">{{ member.user?.displayName || 'Unknown' }}</span>
                </div>
                <span class="text-xs px-2 py-1 rounded-full"
                      [class]="member.role === 'ADMIN'
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : 'bg-gray-500/20 text-gray-400'">
                  {{ member.role }}
                </span>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="glass p-8 text-center animate-pulse" style="color: var(--text-muted);">
          Loading household...
        </div>
      }
    </div>
  `,
})
export class HouseholdDetailComponent implements OnInit {
  household = signal<Household | null>(null);
  members = signal<HouseholdMember[]>([]);
  summary = signal<HouseholdSummary | null>(null);

  private householdId = '';

  constructor(
    private route: ActivatedRoute,
    private householdService: HouseholdService,
    public auth: AuthService,
  ) {}

  ngOnInit() {
    this.householdId = this.route.snapshot.paramMap.get('id') || '';
    this.loadAll();
  }

  loadAll() {
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    this.householdService.getOne(this.householdId).subscribe((h) => this.household.set(h));
    this.householdService.getMembers(this.householdId).subscribe((m) => this.members.set(m));
    this.householdService
      .getSummary(this.householdId, month, year)
      .subscribe((s) => this.summary.set(s));
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
  }

  memberIncomeShare(income: number): number {
    const total = this.summary()?.totalIncome || 1;
    return (income / total) * 50;
  }

  memberExpenseShare(expense: number): number {
    const total = this.summary()?.totalExpenses || 1;
    return (expense / total) * 50;
  }
}
