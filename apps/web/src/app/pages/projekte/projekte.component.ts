import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { KlarSkeletonComponent } from '../../shared/ui/klar-skeleton.component';
import { KlarProgressRingComponent } from '../../shared/ui/klar-progress-ring.component';
import { ProjekteStore } from '../../core/overview/projekte.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { KlarMoneyPipe } from '../../shared/pipes/klar-money.pipe';
import { KlarMoneyClassPipe } from '../../shared/pipes/klar-money-class.pipe';
import { KlarAsyncStateComponent, KlarLoadingTplDirective } from '../../shared/ui/klar-async-state.component';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { ProjectCreateDialogComponent } from './project-create-dialog.component';
import type { ProjectOverviewItem } from '../../core/overview/overview.service';

@Component({
  selector: 'app-projekte',
  standalone: true,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  imports: [NgClass, KlarSkeletonComponent, KlarProgressRingComponent, KlarMoneyPipe, KlarMoneyClassPipe, KlarAsyncStateComponent, KlarLoadingTplDirective],
  templateUrl: './projekte.component.html',
  styleUrl: './projekte.component.css',
})
export class ProjektePageComponent {
  protected store = inject(ProjekteStore);
  private router   = inject(Router);
  private dialogService = inject(KlarDialogService);

  constructor() {
    inject(PageHeaderService).set({
      title:         'Projekte',
      subtitle:      'Haushalt · alle aktiv',
      showPlanspiel: false,
      showAdd:       true,
      addLabel:      'Projekt',
      onAdd:         () => this.openCreate(),
    });
  }

  openCreate(): void {
    this.dialogService.open({
      title:     'Projekt erstellen',
      component: ProjectCreateDialogComponent,
      width:     'sm',
    });
  }

  openProject(project: ProjectOverviewItem): void {
    void this.router.navigate(['/app/projekte', project.id]);
  }

  progressPercent(item: ProjectOverviewItem): number {
    if (!item.totalBudgetCents || item.totalBudgetCents === 0) return 0;
    const pct = (Math.abs(item.spentCents) / Math.abs(item.totalBudgetCents)) * 100;
    return Math.min(100, Math.max(0, Math.round(pct)));
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE':    return 'Aktiv';
      case 'COMPLETED': return 'Abgeschlossen';
      case 'ARCHIVED':  return 'Archiviert';
      default:          return status;
    }
  }

  readonly filters: { value: string; label: string }[] = [
    { value: 'ACTIVE',    label: 'Aktiv' },
    { value: 'COMPLETED', label: 'Abgeschlossen' },
    { value: 'ALL',       label: 'Alle' },
  ];

  setFilter(value: string): void {
    this.store.setStatusFilter(value);
  }
}
