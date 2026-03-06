import { Component, ChangeDetectionStrategy, inject, OnInit, signal, input, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../../core/services/i18n.service';
import { ArticleService } from '../../blog/services/article.service';
import { TagService } from '../../blog/services/tag.service';
import { ArticleSummaryResponse } from '../../../models/article.model';
import { TagResponse } from '../../../models/article.model';
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
  private tagService = inject(TagService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = input<ResumeProfile | null>(null);

  recentPosts = signal<ArticleSummaryResponse[]>([]);
  popularTags = signal<TagResponse[]>([]);

  private static cachedPosts: ArticleSummaryResponse[] | null = null;
  private static cachedTags: TagResponse[] | null = null;

  readonly avatarUrl = computed(() => {
    const url = this.profile()?.avatarUrl;
    if (!url) return null;
    return url;
  });

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
    return bio ?? null;
  });

  readonly tags = computed(() => {
    const blogTags = this.popularTags();
    if (blogTags.length > 0) {
      return blogTags.map(t => ({ name: t.name, slug: t.slug, color: t.color }));
    }
    // Fallback to skills if no blog tags exist yet
    const skills = this.profile()?.skills ?? [];
    if (skills.length === 0) return [];
    const allTags: string[] = [];
    for (const skill of skills) {
      const items = skill.content.split(/,\s*(?![^()]*\))/).map(s => s.trim()).filter(Boolean);
      allTags.push(...items);
    }
    return [...new Set(allTags)].slice(0, 7).map(name => ({ name, slug: '', color: undefined as string | undefined }));
  });

  readonly hasTags = computed(() => this.tags().length > 0);

  ngOnInit(): void {
    if (SidebarSectionComponent.cachedPosts) {
      this.recentPosts.set(SidebarSectionComponent.cachedPosts);
    } else {
      this.articleService.getArticles(0, 5).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (response) => {
          SidebarSectionComponent.cachedPosts = response.content;
          this.recentPosts.set(response.content);
        },
        error: () => {},
      });
    }

    if (SidebarSectionComponent.cachedTags) {
      this.popularTags.set(SidebarSectionComponent.cachedTags);
    } else {
      this.tagService.getTags().pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (tags) => {
          const sorted = [...tags]
            .filter(t => t.articleCount > 0)
            .sort((a, b) => b.articleCount - a.articleCount)
            .slice(0, 7);
          SidebarSectionComponent.cachedTags = sorted;
          this.popularTags.set(sorted);
        },
        error: () => {},
      });
    }
  }
}
