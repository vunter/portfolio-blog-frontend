import { Component, ChangeDetectionStrategy, inject, OnInit, signal, input, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../../core/services/i18n.service';
import { ArticleService } from '../../blog/services/article.service';
import { ArticleSummaryResponse } from '../../../models/article.model';
import { NewsletterSubscribeComponent } from '../../../shared/components/newsletter-subscribe/newsletter-subscribe.component';
import { ResumeProfile } from '../../../models/resume-profile.model';

@Component({
  selector: 'app-sidebar-section',
  imports: [RouterLink, DatePipe, NewsletterSubscribeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar-section.component.html',
  styleUrl: './sidebar-section.component.scss',
})
export class SidebarSectionComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private articleService = inject(ArticleService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = input<ResumeProfile | null>(null);

  recentPosts = signal<ArticleSummaryResponse[]>([]);

  // I-06: Static cache shared across instances to avoid re-fetching on every init
  // Equivalent to shareReplay(1) — using static cache for simplicity with imperative API
  private static cachedPosts: ArticleSummaryResponse[] | null = null;

  readonly displayName = computed(() => this.profile()?.fullName ?? '');

  readonly initials = computed(() => {
    const name = this.displayName();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  });

  readonly sidebarBio = computed(() => {
    const bio = this.profile()?.homeCustomization?.find(i => i.label === 'sidebar_bio')?.content;
    return bio ?? null; // null means use i18n fallback in template
  });

  readonly tags = computed(() => {
    const skills = this.profile()?.skills ?? [];
    if (skills.length === 0) return [];
    // Extract individual skills from skill categories (content may be comma-separated)
    const allTags: string[] = [];
    for (const skill of skills) {
      const items = skill.content.split(/,\s*(?![^()]*\))/).map(s => s.trim()).filter(Boolean);
      allTags.push(...items);
    }
    // Return first 7 unique tags
    return [...new Set(allTags)].slice(0, 7);
  });

  readonly hasTags = computed(() => this.tags().length > 0);

  ngOnInit(): void {
    // I-06: Use static cache to avoid re-fetching on every component init
    if (SidebarSectionComponent.cachedPosts) {
      this.recentPosts.set(SidebarSectionComponent.cachedPosts);
      return;
    }
    this.articleService.getArticles(0, 5).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        SidebarSectionComponent.cachedPosts = response.content;
        this.recentPosts.set(response.content);
      },
      error: () => { /* silently fail — sidebar is non-critical */ },
    });
  }
}
