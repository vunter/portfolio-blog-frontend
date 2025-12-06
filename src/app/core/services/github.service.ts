import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap, shareReplay } from 'rxjs';
import { PublicProfileService } from './public-profile.service';
import { I18nService } from './i18n.service';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

@Injectable({ providedIn: 'root' })
export class GitHubService {
  private readonly http = inject(HttpClient);
  private readonly profileService = inject(PublicProfileService);
  private readonly i18n = inject(I18nService);
  private readonly API_BASE = 'https://api.github.com';

  /** Extract GitHub username from profile URL, fallback to empty string */
  private readonly username = computed(() => {
    const githubUrl = this.profileService.profile()?.github || '';
    const match = githubUrl.match(/github\.com\/([^\/\?\#]+)/);
    return match ? match[1] : '';
  });

  // Cache for repos
  private reposCache$: Observable<GitHubRepo[]> | null = null;

  // Signals for reactive state
  repos = signal<GitHubRepo[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  /**
   * Get public repositories sorted by recent activity
   */
  getRepos(limit = 6): Observable<GitHubRepo[]> {
    const user = this.username();
    if (!user) {
      return of([]);
    }
    if (!this.reposCache$) {
      this.loading.set(true);
      this.reposCache$ = this.http
        .get<GitHubRepo[]>(
          `${this.API_BASE}/users/${user}/repos?sort=pushed&direction=desc&per_page=${limit}`
        )
        .pipe(
          tap((repos) => {
            this.repos.set(repos);
            this.loading.set(false);
          }),
          catchError(() => {
            this.error.set(this.i18n.t('github.loadError'));
            this.loading.set(false);
            this.reposCache$ = null; // Clear cache so next call retries
            return of([]);
          }),
          shareReplay({ bufferSize: 1, refCount: true })
        );
    }
    return this.reposCache$;
  }

  /**
   * Get language color for display
   */
  getLanguageColor(language: string | null): string {
    const colors: Record<string, string> = {
      TypeScript: '#3178c6',
      JavaScript: '#f7df1e',
      Java: '#b07219',
      Python: '#3572A5',
      Go: '#00ADD8',
      Rust: '#dea584',
      Kotlin: '#A97BFF',
      Swift: '#F05138',
      Ruby: '#CC342D',
      PHP: '#4F5D95',
      'C#': '#239120',
      'C++': '#f34b7d',
      C: '#555555',
      HTML: '#e34c26',
      CSS: '#1572B6',
      Shell: '#89e051',
      Dockerfile: '#384d54',
    };
    return colors[language || ''] || '#8b949e';
  }

  /**
   * Format date relative to now
   */
  formatRelativeDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return this.i18n.t('common.today');
    if (diffDays === 1) return this.i18n.t('common.yesterday');
    if (diffDays < 7) return this.i18n.t('common.daysAgo', { count: diffDays.toString() });
    if (diffDays < 30) return this.i18n.t('common.weeksAgo', { count: Math.floor(diffDays / 7).toString() });
    if (diffDays < 365) return this.i18n.t('common.monthsAgo', { count: Math.floor(diffDays / 30).toString() });
    return this.i18n.t('common.yearsAgo', { count: Math.floor(diffDays / 365).toString() });
  }
}
