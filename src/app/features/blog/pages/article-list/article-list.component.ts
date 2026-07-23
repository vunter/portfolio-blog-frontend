import { Component, inject, signal, OnInit, DestroyRef, ChangeDetectionStrategy, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';
import { ArticleService } from '../../services/article.service';
import { TagService } from '../../services/tag.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { SeoService } from '../../../../core/services/seo.service';
import { ArticleCardComponent } from '../../../../shared/components/article-card/article-card.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { TagCloudComponent } from '../../../../shared/components/tag-cloud/tag-cloud.component';
import { NewsletterSubscribeComponent } from '../../../../shared/components/newsletter-subscribe/newsletter-subscribe.component';
import { ArticleSummaryResponse, TagResponse, PageResponse } from '../../../../models';
import { scrollBehavior } from '../../../../shared/utils/scroll.util';

@Component({
  selector: 'app-article-list',
  imports: [
    RouterLink,
    ArticleCardComponent,
    PaginationComponent,
    EmptyStateComponent,
    SkeletonComponent,
    TagCloudComponent,
    NewsletterSubscribeComponent,
  ],
  templateUrl: './article-list.component.html',
  styleUrl: './article-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleListComponent implements OnInit {
  private articleService = inject(ArticleService);
  private tagService = inject(TagService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);
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
  activeTagSlug = signal<string | null>(null);
  popularArticles = signal<ArticleSummaryResponse[]>([]);
  dateFrom = signal('');
  dateTo = signal('');
  searchQuery = signal('');
  showDateFilter = signal(false);
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;
  private firstLoad = true;
  // Drives loads through switchMap so a slow earlier response can't land after a
  // newer one (rapid page clicks / filter typing would otherwise show a stale page).
  private readonly load$ = new Subject<number>();

  constructor() {
    this.load$.pipe(
      tap(() => { this.loading.set(true); this.error.set(false); }),
      switchMap((page) => {
        const tagSlug = this.activeTagSlug();
        const from = this.dateFrom() || undefined;
        const to = this.dateTo() || undefined;
        const source$ = tagSlug
          ? this.articleService.getArticlesByTag(tagSlug, page, 9)
          : this.articleService.getArticles(page, 9, from, to, this.searchQuery() || undefined);
        return source$.pipe(catchError(() => {
          this.error.set(true);
          this.loading.set(false);
          return EMPTY;
        }));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((response: PageResponse<ArticleSummaryResponse>) => {
      this.articles.set(response.content);
      this.currentPage.set(response.page);
      this.totalPages.set(response.totalPages);
      this.totalElements.set(response.totalElements);
      this.loading.set(false);
    });

    this.destroyRef.onDestroy(() => {
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
    });
  }

  ngOnInit(): void {
    // Hydrate page/search/date state from the URL so back/refresh/share restores it.
    const qp = this.route.snapshot.queryParamMap;
    this.currentPage.set(Number(qp.get('page')) || 0);
    this.searchQuery.set(qp.get('q') || '');
    this.dateFrom.set(qp.get('from') || '');
    this.dateTo.set(qp.get('to') || '');
    if (this.dateFrom() || this.dateTo()) this.showDateFilter.set(true);

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
        // First emission restores the hydrated page; a later tag navigation resets to 0.
        if (this.firstLoad) {
          this.firstLoad = false;
          this.loadArticles(this.currentPage());
        } else {
          this.currentPage.set(0);
          this.loadArticles(0);
        }
      });
    this.loadTags();
    this.loadPopular();
  }

  loadArticles(page = 0): void {
    this.load$.next(page);
  }

  /** Mirror the current page/search/date state into the URL query params. */
  private syncUrl(replaceUrl: boolean): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: this.currentPage() > 0 ? this.currentPage() : null,
        q: this.searchQuery() || null,
        from: this.dateFrom() || null,
        to: this.dateTo() || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl,
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
    this.currentPage.set(page);
    this.loadArticles(page);
    this.syncUrl(false);
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
    }
  }

  onDateFromChange(event: Event): void {
    this.dateFrom.set((event.target as HTMLInputElement).value);
    this.scheduleFilterReload();
  }

  onDateToChange(event: Event): void {
    this.dateTo.set((event.target as HTMLInputElement).value);
    this.scheduleFilterReload();
  }

  clearDateFilter(): void {
    this.dateFrom.set('');
    this.dateTo.set('');
    this.currentPage.set(0);
    this.loadArticles(0);
    this.syncUrl(true);
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.scheduleFilterReload();
  }

  /**
   * Browsers fire input events on partial date entries (e.g. while the user
   * is still typing the year), so debounce all filter changes through one
   * timer rather than firing a request per keystroke.
   */
  private scheduleFilterReload(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage.set(0);
      this.loadArticles(0);
      this.syncUrl(true);
    }, 400);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.currentPage.set(0);
    this.loadArticles(0);
    this.syncUrl(true);
  }

  toggleDateFilter(): void {
    this.showDateFilter.update(v => !v);
  }

  clearAllFilters(): void {
    this.searchQuery.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.showDateFilter.set(false);
    this.currentPage.set(0);
    this.loadArticles(0);
    this.syncUrl(true);
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery() || this.dateFrom() || this.dateTo());
  }
}
