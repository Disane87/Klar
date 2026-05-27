import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { currentYearMonth } from '@klar/shared';
import { HouseholdStore } from '../household/household.store';
import { OverviewService } from './overview.service';
import type {
  FixedCostsOverview,
  CashflowOverview,
  LiquidityForecast,
} from './overview.service';

@Injectable({ providedIn: 'root' })
export class OverviewStore {
  private overviewService = inject(OverviewService);
  private householdStore  = inject(HouseholdStore);

  readonly currentMonth = signal(currentYearMonth());

  // ── Fixed costs resource — reloads when householdId or month changes ─────────
  private fixedCostsResource = resource<FixedCostsOverview | undefined, { householdId: string | null; month: string }>({
    params: () => ({
      householdId: this.householdStore.activeId(),
      month:       this.currentMonth(),
    }),
    loader: ({ params }) => {
      if (!params.householdId) return Promise.resolve(undefined);
      return firstValueFrom(
        this.overviewService.getFixedCosts(params.householdId, params.month)
      );
    },
  });

  // ── Cashflow resource — reloads when householdId or month changes ────────────
  private cashflowResource = resource<CashflowOverview | undefined, { householdId: string | null; month: string }>({
    params: () => ({
      householdId: this.householdStore.activeId(),
      month:       this.currentMonth(),
    }),
    loader: ({ params }) => {
      if (!params.householdId) return Promise.resolve(undefined);
      return firstValueFrom(
        this.overviewService.getCashflow(params.householdId, params.month)
      );
    },
  });

  // ── Liquidity-Forecast resource — always for the current month ──────────────
  private liquidityResource = resource<LiquidityForecast | undefined, { householdId: string | null }>({
    params: () => ({ householdId: this.householdStore.activeId() }),
    loader: ({ params }) => {
      if (!params.householdId) return Promise.resolve(undefined);
      return firstValueFrom(
        this.overviewService.getLiquidityForecast(params.householdId),
      );
    },
  });

  // ── Public signals ────────────────────────────────────────────────────────────
  readonly fixedCosts = this.fixedCostsResource.value;
  readonly cashflow   = this.cashflowResource.value;
  readonly liquidity  = this.liquidityResource.value;

  readonly loading = computed(
    () =>
      this.fixedCostsResource.isLoading() ||
      this.cashflowResource.isLoading() ||
      this.liquidityResource.isLoading(),
  );

  readonly error = computed(
    () =>
      this.fixedCostsResource.error() ??
      this.cashflowResource.error() ??
      this.liquidityResource.error(),
  );

  // ── Actions ───────────────────────────────────────────────────────────────────
  setMonth(month: string): void {
    this.currentMonth.set(month);
  }

  reload(): void {
    this.fixedCostsResource.reload();
    this.cashflowResource.reload();
    this.liquidityResource.reload();
  }
}
