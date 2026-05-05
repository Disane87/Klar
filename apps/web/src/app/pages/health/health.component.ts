import { Component, inject, OnInit } from '@angular/core';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { VersionService, GithubRelease } from '../../core/version/version.service';
import { KlarIconComponent } from '../../shared/icons/klar-icon.component';
import { KlarSectionHeaderComponent } from '../../shared/ui/klar-section-header.component';
import { KlarSkeletonRowsComponent } from '../../shared/ui/klar-skeleton-rows.component';

@Component({
  selector: 'klar-health-page',
  standalone: true,
  imports: [
    KlarIconComponent,
    KlarSectionHeaderComponent,
    KlarSkeletonRowsComponent,
  ],
  templateUrl: './health.component.html',
})
export class HealthPageComponent implements OnInit {
  private pageHeader = inject(PageHeaderService);
  protected version = inject(VersionService);

  ngOnInit(): void {
    this.pageHeader.set({ title: 'System', subtitle: 'Status & Changelogs' });
    this.version.reload();
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  protected trackRelease(_: number, r: GithubRelease): string {
    return r.tag_name;
  }
}
