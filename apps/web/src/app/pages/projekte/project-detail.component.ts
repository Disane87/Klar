import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { HouseholdStore } from '../../core/household/household.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { OverviewService, type ProjectOverviewItem } from '../../core/overview/overview.service';
import { ProjectsService, type ProjectResponse } from '../../core/projects/projects.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarConfirmService } from '../../shared/ui/klar-confirm.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { KlarErrorBarComponent } from '../../shared/ui/klar-error-bar.component';
import { KlarEmptyStateComponent } from '../../shared/ui/klar-empty-state.component';
import { KlarButtonComponent } from '../../shared/ui/klar-button.component';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { BrandIconComponent } from '../../shared/ui/brand-icon.component';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { ProjectCreateDialogComponent } from './project-create-dialog.component';
import { TransactionDialogComponent } from '../buchungen/transaction-dialog.component';
import type { Transaction } from '../../core/transactions/transactions.store';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [
    NgClass,
    KlarSkeletonComponent,
    KlarErrorBarComponent,
    KlarEmptyStateComponent,
    KlarButtonComponent,
    KlarIconComponent,
    BrandIconComponent,
    KlarMoneyPipe,
    KlarMoneyClassPipe,
  ],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.css',
})
export class ProjectDetailPageComponent {
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);
  private http         = inject(HttpClient);
  private household    = inject(HouseholdStore);
  private overviewSvc  = inject(OverviewService);
  private projectsSvc  = inject(ProjectsService);
  private dialog       = inject(KlarDialogService);
  private confirm      = inject(KlarConfirmService);
  private toast        = inject(KlarToastService);
  private pageHeader   = inject(PageHeaderService);

  private readonly paramMap = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  private readonly id = computed(() => this.paramMap().get('id') ?? '');

  // ── Project metadata (from list endpoint, status=ALL) ────────────────────────
  private projectResource = resource<ProjectResponse | null, { householdId: string | null; id: string }>({
    params: () => ({ householdId: this.household.activeId(), id: this.id() }),
    loader: async ({ params }) => {
      if (!params.householdId || !params.id) return null;
      const list = await this.projectsSvc.list(params.householdId);
      return list.find(p => p.id === params.id) ?? null;
    },
  });

  // ── Project stats (from overview endpoint, status=ALL) ───────────────────────
  private statsResource = resource<ProjectOverviewItem | null, { householdId: string | null; id: string }>({
    params: () => ({ householdId: this.household.activeId(), id: this.id() }),
    loader: async ({ params }) => {
      if (!params.householdId || !params.id) return null;
      const data = await firstValueFrom(this.overviewSvc.getProjects(params.householdId));
      return data.projects.find(p => p.id === params.id) ?? null;
    },
  });

  // ── Transactions for this project (all months) ───────────────────────────────
  private txResource = resource<Transaction[], { householdId: string | null; id: string }>({
    params: () => ({ householdId: this.household.activeId(), id: this.id() }),
    loader: async ({ params }) => {
      if (!params.householdId || !params.id) return [];
      return firstValueFrom(
        this.http.get<Transaction[]>(
          `/api/v1/households/${params.householdId}/transactions`,
          { params: { projectId: params.id } },
        ),
      );
    },
  });

  readonly project   = this.projectResource.value;
  readonly stats     = this.statsResource.value;
  readonly tx        = this.txResource.value;
  readonly loading   = computed(() =>
    this.projectResource.isLoading() || this.statsResource.isLoading() || this.txResource.isLoading(),
  );
  readonly error     = computed(() => this.projectResource.error() || this.statsResource.error() || this.txResource.error());
  readonly notFound  = computed(() => !this.loading() && !this.error() && !this.project());
  readonly txEmpty   = computed(() => (this.tx()?.length ?? 0) === 0);

  readonly sortedTx = computed(() => {
    const list = this.tx() ?? [];
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  });

  readonly plannedTx = computed(() => this.sortedTx().filter(t => t.isPlanned));
  readonly realizedTx = computed(() => this.sortedTx().filter(t => !t.isPlanned));

  readonly progressPercent = computed(() => {
    const s = this.stats();
    if (!s || !s.totalBudgetCents || s.totalBudgetCents === 0) return 0;
    const pct = (Math.abs(s.spentCents) / Math.abs(s.totalBudgetCents)) * 100;
    return Math.min(100, Math.max(0, Math.round(pct)));
  });

  readonly plannedProgressPercent = computed(() => {
    const s = this.stats();
    if (!s || !s.totalBudgetCents || s.totalBudgetCents === 0) return 0;
    const combined = Math.abs(s.spentCents) + Math.abs(s.plannedSpentCents);
    const pct = (combined / Math.abs(s.totalBudgetCents)) * 100;
    return Math.min(100, Math.max(0, Math.round(pct)));
  });

  /** Devation per realized transaction (signed cents): null if no plan archived. */
  deviationFor(tx: Transaction): number | null {
    if (tx.isPlanned || tx.plannedAmountCents === null) return null;
    return tx.amountCents - tx.plannedAmountCents;
  }

  readonly deleting = signal(false);
  private wasDialogActive = false;

  constructor() {
    this.pageHeader.set({
      title:    'Projekt',
      subtitle: 'DETAILS',
    });

    effect(() => {
      const active = this.dialog.active();
      if (this.wasDialogActive && !active) {
        this.projectResource.reload();
        this.statsResource.reload();
        this.txResource.reload();
      }
      this.wasDialogActive = active;
    });
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE':    return 'Aktiv';
      case 'COMPLETED': return 'Abgeschlossen';
      case 'ARCHIVED':  return 'Archiviert';
      default:          return status;
    }
  }

  formatDate(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}.${parts[1]}.${parts[0].slice(2)}`;
  }

  formatRange(): string {
    const p = this.project();
    if (!p) return '';
    if (p.startDate && p.endDate) return `${this.formatDate(p.startDate)} – ${this.formatDate(p.endDate)}`;
    if (p.startDate)              return `ab ${this.formatDate(p.startDate)}`;
    if (p.endDate)                return `bis ${this.formatDate(p.endDate)}`;
    return '';
  }

  back(): void {
    void this.router.navigate(['/app/projekte']);
  }

  openEdit(): void {
    const p = this.project();
    if (!p) return;
    this.dialog.open({
      title:     'Projekt bearbeiten',
      component: ProjectCreateDialogComponent,
      inputs:    { item: p },
      width:     'sm',
    });
  }

  openCreateTransaction(planned: boolean): void {
    const p = this.project();
    if (!p) return;
    this.dialog.open({
      title:     planned ? 'Geplante Buchung anlegen' : 'Buchung anlegen',
      component: TransactionDialogComponent,
      inputs:    { tx: null, presetProjectId: p.id, presetPlanned: planned },
      width:     'sm',
    });
  }

  openEditTransaction(tx: Transaction): void {
    this.dialog.open({
      title:     tx.isPlanned ? 'Geplante Buchung bearbeiten' : 'Buchung bearbeiten',
      component: TransactionDialogComponent,
      inputs:    { tx },
      width:     'sm',
    });
  }

  async archive(): Promise<void> {
    const p = this.project();
    if (!p || this.deleting()) return;
    const hid = this.household.activeId();
    if (!hid) return;
    this.deleting.set(true);
    try {
      await this.projectsSvc.patch(hid, p.id, { status: 'ARCHIVED' });
      this.projectResource.reload();
      this.statsResource.reload();
      this.toast.success('Projekt archiviert');
    } catch {
      this.toast.error('Archivieren fehlgeschlagen');
    } finally {
      this.deleting.set(false);
    }
  }

  async remove(): Promise<void> {
    const p = this.project();
    if (!p || this.deleting()) return;
    const hid = this.household.activeId();
    if (!hid) return;
    const ok = await this.confirm.ask({
      title: 'Projekt löschen?',
      message: `Projekt „${p.name}" wirklich löschen?`,
      detail: 'Hat das Projekt Buchungen, wird es stattdessen archiviert.',
      confirmLabel: 'Löschen',
      tone: 'danger',
    });
    if (!ok) return;

    this.deleting.set(true);
    try {
      await this.projectsSvc.delete(hid, p.id);
      this.toast.success('Projekt gelöscht');
      void this.router.navigate(['/app/projekte']);
    } catch {
      this.toast.error('Löschen fehlgeschlagen');
      this.deleting.set(false);
    }
  }
}
