import { inject, Injectable, resource, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface HealthInfo {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
}

export interface GithubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
}

const GITHUB_RELEASES_URL =
  'https://api.github.com/repos/Disane87/Klar/releases';

const SEEN_VERSION_KEY = 'klar:seen-version';

@Injectable({ providedIn: 'root' })
export class VersionService {
  private http = inject(HttpClient);

  private _healthResource = resource<HealthInfo, void>({
    loader: () => firstValueFrom(this.http.get<HealthInfo>('/health')),
  });

  private _releasesResource = resource<GithubRelease[], void>({
    loader: () =>
      firstValueFrom(
        this.http.get<GithubRelease[]>(GITHUB_RELEASES_URL, {
          params: { per_page: '5' },
          headers: { Accept: 'application/vnd.github+json' },
        }),
      ),
  });

  readonly healthLoading = computed(() => this._healthResource.isLoading());
  readonly healthError   = computed(() => this._healthResource.error());

  readonly currentVersion = computed(
    () => this._healthResource.value()?.version ?? 'dev',
  );

  readonly apiStatus = computed<'ok' | 'error' | null>(() => {
    if (this._healthResource.isLoading()) return null;
    if (this._healthResource.error()) return 'error';
    return this._healthResource.value()?.status ?? null;
  });

  readonly latestRelease = computed(() => {
    const releases = this._releasesResource.value();
    if (!releases?.length) return null;
    return releases.find((r) => !r.prerelease) ?? null;
  });

  readonly latestVersion = computed(
    () => this.latestRelease()?.tag_name?.replace(/^v/, '') ?? null,
  );

  readonly updateAvailable = computed(() => {
    const current = this.currentVersion();
    const latest = this.latestVersion();
    if (!latest || current === 'dev') return false;
    return current !== latest;
  });

  readonly updateDismissed = signal(false);

  readonly showUpdateBanner = computed(
    () => this.updateAvailable() && !this.updateDismissed(),
  );

  readonly releases = computed(() => this._releasesResource.value() ?? []);

  readonly releasesLoading = computed(() => this._releasesResource.isLoading());

  constructor() {
    // Dismiss banner if user has already seen this version
    effect(() => {
      const latest = this.latestVersion();
      if (!latest) return;
      const seen = localStorage.getItem(SEEN_VERSION_KEY);
      if (seen === latest) {
        this.updateDismissed.set(true);
      }
    });
  }

  dismiss(): void {
    const latest = this.latestVersion();
    if (latest) {
      localStorage.setItem(SEEN_VERSION_KEY, latest);
    }
    this.updateDismissed.set(true);
  }

  reload(): void {
    this._healthResource.reload();
    this._releasesResource.reload();
  }
}
