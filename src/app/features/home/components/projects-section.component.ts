import { Component, ChangeDetectionStrategy, inject, OnInit, signal, input, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { I18nService } from '../../../core/services/i18n.service';
import { GitHubService, GitHubRepo } from '../../../core/services/github.service';
import { ResumeProfile } from '../../../models/resume-profile.model';

@Component({
  selector: 'app-projects-section',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projects-section.component.html',
  styleUrl: './projects-section.component.scss',
})
export class ProjectsSectionComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private githubService = inject(GitHubService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = input<ResumeProfile | null>(null);

  githubRepos = signal<GitHubRepo[]>([]);

  readonly projects = computed(() => {
    const items = this.profile()?.projects ?? [];
    return items.length > 0 ? [...items].sort((a, b) => a.sortOrder - b.sortOrder) : [];
  });

  readonly hasProjects = computed(() => this.projects().length > 0);

  readonly githubProfileUrl = computed(() => {
    const url = this.profile()?.github;
    if (!url) return null;
    return url.startsWith('http') ? url : 'https://' + url;
  });

  readonly githubDisplayName = computed(() => {
    const url = this.githubProfileUrl();
    return url ? url.replace(/^https?:\/\//, '') : '';
  });

  ngOnInit(): void {
    this.githubService.getRepos(6).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (repos) => this.githubRepos.set(repos),
      error: () => { /* silently fail — projects section is non-critical */ },
    });
  }

  getLanguageColor(language: string | null): string {
    return this.githubService.getLanguageColor(language);
  }

  formatRelativeDate(date: string): string {
    return this.githubService.formatRelativeDate(date);
  }
}
