import { Component, inject, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
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
  private sanitizer = inject(DomSanitizer);
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

  protected formatDateTime(date: Date | null): string {
    if (!date) return '–';
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected renderMarkdown(body: string): SafeHtml {
    const html = marked.parse(body, { async: false, gfm: true, breaks: true }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  protected trackRelease(_: number, r: GithubRelease): string {
    return r.tag_name;
  }
}
