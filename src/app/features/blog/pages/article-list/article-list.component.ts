import { Component, inject, signal, OnInit, DestroyRef, ChangeDetectionStrategy, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ArticleService } from '../../services/article.service';
import { TagService } from '../../services/tag.service';
import { ApiService } from '../../../../core/services/api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { RecaptchaService } from '../../../../core/services/recaptcha.service';
import { SeoService } from '../../../../core/services/seo.service';
import { ArticleCardComponent } from '../../../../shared/components/article-card/article-card.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { ArticleSummaryResponse, TagResponse, PageResponse } from '../../../../models';

@Component({
  selector: 'app-article-list',
  imports: [
    RouterLink,
    FormsModule,
    ArticleCardComponent,
    PaginationComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
    SkeletonComponent,
  ],
  templateUrl: './article-list.component.html',
  styleUrl: './article-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleListComponent implements OnInit {
  private articleService = inject(ArticleService);
  private tagService = inject(TagService);
  private apiService = inject(ApiService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);
  private recaptcha = inject(RecaptchaService);
  private seo = inject(SeoService);
  readonly i18n = inject(I18nService);

  articles = signal<ArticleSummaryResponse[]>([]);
  tags = signal<TagResponse[]>([]);
  loading = signal(true);
  error = signal(false);
  tagsLoading = signal(true);
  currentPage = signal(0);
  totalPages = signal(0);
  totalElements = signal(0);
  newsletterEmail = '';
  newsletterSubmitting = signal(false);
  activeTagSlug = signal<string | null>(null);
  popularArticles = signal<ArticleSummaryResponse[]>([]);
  dateFrom = signal('');
  dateTo = signal('');

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const tagSlug = params.get('slug');
        this.activeTagSlug.set(tagSlug);
        if (tagSlug) {
          this.seo.update({
            title: this.i18n.t('seo.blog.tagTitle', { tag: tagSlug }),
            description: this.i18n.t('seo.blog.tagDescription', { tag: tagSlug }),
            url: `/blog/tag/${tagSlug}`,
            locale: this.seo.getLocale(this.i18n.language()),
          });
        } else {
          this.seo.update({
            title: this.i18n.t('blog.title'),
            description: this.i18n.t('seo.blog.description'),
            url: '/blog',
            locale: this.seo.getLocale(this.i18n.language()),
          });
        }
        this.loadArticles(0);
      });
    this.loadTags();
    this.loadPopular();
  }

  loadArticles(page = 0): void {
    this.loading.set(true);
    this.error.set(false);
    const tagSlug = this.activeTagSlug();
    const from = this.dateFrom() || undefined;
    const to = this.dateTo() || undefined;
    const source$ = tagSlug
      ? this.articleService.getArticlesByTag(tagSlug, page, 9)
      : this.articleService.getArticles(page, 9, from, to);

    source$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: PageResponse<ArticleSummaryResponse>) => {
        this.articles.set(response.content);
        this.currentPage.set(response.page);
        this.totalPages.set(response.totalPages);
        this.totalElements.set(response.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  loadTags(): void {
    this.tagsLoading.set(true);
    this.tagService.getTags()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tags) => {
          this.tags.set(tags);
          this.tagsLoading.set(false);
        },
        error: () => {
          this.tagsLoading.set(false);
        },
      });
  }

  loadPopular(): void {
    this.articleService.getPopularArticles(5)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.popularArticles.set(response.content),
        error: () => { /* Popular articles sidebar is non-critical — silent fail */ },
      });
  }

  onPageChange(page: number): void {
    this.loadArticles(page);
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  onDateFromChange(event: Event): void {
    this.dateFrom.set((event.target as HTMLInputElement).value);
    this.loadArticles(0);
  }

  onDateToChange(event: Event): void {
    this.dateTo.set((event.target as HTMLInputElement).value);
    this.loadArticles(0);
  }

  clearDateFilter(): void {
    this.dateFrom.set('');
    this.dateTo.set('');
    this.loadArticles(0);
  }

  subscribeNewsletter(event: Event): void {
    event.preventDefault();
    const email = this.newsletterEmail.trim();
    if (!email) return;

    this.newsletterSubmitting.set(true);
    this.recaptcha.execute('subscribe').then(recaptchaToken => {
      this.apiService.post('/newsletter/subscribe', { email, recaptchaToken })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.notification.success(this.i18n.t('blog.newsletter.success'));
            this.newsletterEmail = '';
            this.newsletterSubmitting.set(false);
          },
          error: () => {
            this.notification.error(this.i18n.t('blog.newsletter.error'));
            this.newsletterSubmitting.set(false);
          },
        });
    }).catch(() => {
      this.newsletterSubmitting.set(false);
      this.notification.error(this.i18n.t('blog.newsletter.error'));
    });
  }
}
