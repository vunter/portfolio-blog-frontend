// Error handling: NotificationService for transient errors, null article signal for persistent load failures
// DOM utilities (addCopyButtons, buildTableOfContents) are coupled to Renderer2/NgZone — kept inline
import {
  Component,
  inject,
  signal,
  untracked,
  OnInit,
  ChangeDetectionStrategy,
  computed,
  effect,
  PLATFORM_ID,
  DestroyRef,
  Renderer2,
  ElementRef,
  NgZone,
} from '@angular/core';
import { DatePipe, isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MarkdownModule } from 'ngx-markdown';
// PERF-F-02: PrismJS is lazy-loaded only when article content is rendered,
// instead of being included in global scripts (which blocked initial page load).
// ngx-markdown auto-detects window.Prism for syntax highlighting.
import { ScrollDepthTrackerService } from './services/scroll-depth-tracker.service';
import { ArticleService } from '../../services/article.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { SeoService } from '../../../../core/services/seo.service';
import { AnalyticsTrackingService } from '../../../../core/services/analytics-tracking.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { ArticleCardComponent } from '../../../../shared/components/article-card/article-card.component';
import { BreadcrumbsComponent, Breadcrumb } from '../../../../shared/components/breadcrumbs/breadcrumbs.component';
import { getInitials } from '../../../../shared/utils/string.utils';
import {
  ArticleResponse,
  ArticleSummaryResponse,
} from '../../../../models';
import { ArticleCommentsComponent } from './components/article-comments/article-comments.component';
import { shareNative, shareTwitter as shareTwitterUtil, shareLinkedIn as shareLinkedInUtil, shareFacebook as shareFacebookUtil, copyArticleLink } from './utils/share.util';
import { ContentProcessorService } from './services/content-processor.service';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

@Component({
  selector: 'app-article-detail',
  imports: [
    RouterLink,
    DatePipe,
    NgOptimizedImage,
    MarkdownModule,
    SkeletonComponent,
    ArticleCardComponent,
    BreadcrumbsComponent,
    ArticleCommentsComponent,
  ],
  templateUrl: './article-detail.component.html',
  styleUrl: './article-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // PERF-F-03: Scroll listener moved from host binding to NgZone.runOutsideAngular()
  // to prevent unnecessary change detection on every scroll event.
})
export class ArticleDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly articleService = inject(ArticleService);
  private readonly notification = inject(NotificationService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly renderer = inject(Renderer2);
  private readonly elementRef = inject(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly seo = inject(SeoService);
  readonly i18n = inject(I18nService);
  readonly authStore = inject(AuthStore);
  private readonly analytics = inject(AnalyticsTrackingService);
  private readonly contentProcessor = inject(ContentProcessorService);
  private readonly scrollDepthTracker = inject(ScrollDepthTrackerService);

  readonly dateLocale = computed(() => {
    const lang = this.i18n.language();
    const map: Record<string, string> = { en: 'en-US', pt: 'pt-BR', es: 'es', it: 'it' };
    return map[lang] || 'en-US';
  });

  article = signal<ArticleResponse | null>(null);
  relatedArticles = signal<ArticleSummaryResponse[]>([]);
  loading = signal(true);
  liked = signal(false);
  likePending = signal(false);
  commentTotalElements = signal(0);

  // Reading progress & ToC
  readingProgress = signal(0);
  activeHeadingId = signal<string>('');

  breadcrumbs = computed<Breadcrumb[]>(() => {
    const article = this.article();
    const crumbs: Breadcrumb[] = [
      { label: this.i18n.t('blog.breadcrumb'), route: '/blog' },
    ];
    if (article?.tags?.length) {
      crumbs.push({ label: article.tags[0].name, route: `/blog/tag/${article.tags[0].slug}` });
    }
    if (article) {
      crumbs.push({ label: article.title });
    }
    return crumbs;
  });
  private headingsProcessed = false;
  private codeBlocksProcessed = false;
  private headingObserver: IntersectionObserver | null = null;
  private progressObserver: IntersectionObserver | null = null;
  private readonly eventCleanups: (() => void)[] = [];

  tocItems = computed(() => {
    const content = this.article()?.content;
    if (!content) return [];
    const items: TocItem[] = [];
    const lines = content.split('\n');
    let inCodeBlock = false;
    for (const line of lines) {
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;
      const match = line.match(/^(#{2,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].replace(/[*_`[\]]/g, '').trim();
        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        items.push({ id, text, level });
      }
    }
    return items;
  });

  private currentSlug: string | null = null;
  private isLanguageReload = false;

  constructor() {
    // F-328: DestroyRef-based cleanup replaces manual ngOnDestroy
    this.destroyRef.onDestroy(() => {
      this.headingObserver?.disconnect();
      this.scrollDepthTracker.destroy();
      this.progressObserver?.disconnect();
      // Send time-on-page analytics on navigation away
      const article = this.article();
      this.analytics.stopTimeTracking(article?.id ? +article.id : undefined);
      this.eventCleanups.forEach(cleanup => cleanup());
      this.eventCleanups.length = 0;
    });

    // Reload article when language changes (to get localized content)
    // BUG-19 FIX: Use untracked() for loading() to prevent infinite loop.
    // Without untracked, the effect depends on loading(), so every time
    // loadArticle completes (loading false→true→false), the effect re-fires.
    effect(() => {
      const _lang = this.i18n.language(); // track language changes
      if (this.currentSlug && !untracked(() => this.loading())) {
        this.isLanguageReload = true;
        untracked(() => this.loadArticle(this.currentSlug!));
      }
    });

    // PERF-01: Use afterNextRender + effect instead of ngAfterViewChecked
    // This runs only once per render cycle, not on every change detection.
    // The progress observer ALSO needs to wait for the article DOM to render —
    // calling it from ngOnInit returned null because .article-content wasn't
    // in the tree yet.
    effect(() => {
      const article = this.article();
      if (article && isPlatformBrowser(this.platformId)) {
        requestAnimationFrame(() => {
          this.processArticleContent();
          this.zone.runOutsideAngular(() => this.initProgressObserver());
        });
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const slug = params.get('slug');
      if (slug) {
        this.currentSlug = slug;
        this.loadArticle(slug);
      }
    });
  }

  // Q7.1: DOM processing delegated to ContentProcessorService
  private processArticleContent(): void {
    const hostEl = this.elementRef.nativeElement as HTMLElement;

    if (!this.headingsProcessed) {
      const contentEl = hostEl.querySelector('.article-content');
      if (contentEl) {
        const headings = this.contentProcessor.processHeadings(this.renderer, contentEl);
        if (headings.length > 0) {
          this.headingsProcessed = true;
          this.setupHeadingObserver(headings);
        }
      }
    }

    if (!this.codeBlocksProcessed) {
      const codeBlocks = hostEl.querySelectorAll('.article-content pre');
      if (codeBlocks.length > 0) {
        const cleanups = this.contentProcessor.addCopyButtons(this.renderer, hostEl);
        this.eventCleanups.push(...cleanups);
        this.codeBlocksProcessed = true;
      }
    }
  }

  private setupHeadingObserver(headings: NodeListOf<Element>): void {
    this.headingObserver?.disconnect();
    this.headingObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.activeHeadingId.set(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );
    headings.forEach((h) => this.headingObserver!.observe(h));
  }

  /**
   * Q8.3: IntersectionObserver-based reading progress — replaces scroll listener.
   * Observes the article content element with fine-grained thresholds.
   */
  private initProgressObserver(): void {
    const hostEl = this.elementRef.nativeElement as HTMLElement;
    const contentEl = hostEl.querySelector('.article-content');
    if (!contentEl) return;

    // Generate thresholds at 1% intervals for smooth progress
    const thresholds = Array.from({ length: 101 }, (_, i) => i / 100);

    this.progressObserver?.disconnect();
    this.progressObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        // intersectionRatio tells us how much of the article is visible;
        // as user scrolls down, the ratio of the part above viewport increases.
        // Use the bounding rect to compute actual read progress.
        const rect = entry.boundingClientRect;
        const viewportHeight = entry.rootBounds?.height ?? window.innerHeight;
        const totalHeight = rect.height;
        if (totalHeight <= 0) continue;
        // How far the top of the article has scrolled past the top of the viewport
        const scrolledPast = Math.max(0, -rect.top);
        const progress = Math.min((scrolledPast / (totalHeight - viewportHeight)) * 100, 100);
        this.readingProgress.set(Math.max(0, progress));
      }
    }, { threshold: thresholds });
    this.progressObserver.observe(contentEl);
  }

  loadArticle(slug: string): void {
    this.loading.set(true);
    this.headingsProcessed = false;
    this.codeBlocksProcessed = false;
    this.articleService.getArticleBySlug(slug).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (article) => {
        this.article.set(article);
        this.loading.set(false);
        this.seo.update({
          title: article.seoTitle || article.metaTitle || article.title,
          description: article.seoDescription || article.metaDescription || article.excerpt || '',
          url: `/blog/${article.slug}`,
          image: article.coverImageUrl,
          type: 'article',
          publishedTime: article.publishedAt,
          modifiedTime: article.updatedAt,
          author: article.author?.name,
          tags: article.tags?.map(t => t.name),
        });
        if (!this.isLanguageReload) {
          this.trackView(slug);
        }
        this.isLanguageReload = false;
        this.loadRelatedArticles(slug);
        this.loadLikeStatus(slug);
      },
      error: () => {
        this.article.set(null);
        this.loading.set(false);
      },
    });
  }

  retryLoadArticle(): void {
    if (this.currentSlug) {
      this.loadArticle(this.currentSlug);
    }
  }

  trackView(slug: string): void {
    this.articleService.trackView(slug).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      error: () => { /* view tracking is non-critical */ }
    });
    // Start time-on-page tracking
    this.analytics.startTimeTracking();
    // Init scroll depth tracking
    const article = this.article();
    this.scrollDepthTracker.init(article?.id ? +article.id : undefined);
    // Send UTM attribution if present
    if (isPlatformBrowser(this.platformId)) {
      const params = new URLSearchParams(window.location.search);
      const utmSource = params.get('utm_source');
      if (utmSource) {
        const article = this.article();
        const metadata: Record<string, string> = { utm_source: utmSource };
        const utmMedium = params.get('utm_medium');
        const utmCampaign = params.get('utm_campaign');
        if (utmMedium) metadata['utm_medium'] = utmMedium;
        if (utmCampaign) metadata['utm_campaign'] = utmCampaign;
        this.articleService.trackUtmView(article?.id ? +article.id : undefined, metadata);
      }
    }
  }

  onCommentCountChange(count: number): void {
    this.commentTotalElements.set(count);
  }

  loadRelatedArticles(slug: string): void {
    this.articleService.getRelatedArticles(slug).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (articles) => this.relatedArticles.set(articles),
      error: () => this.relatedArticles.set([]),
    });
  }

  loadLikeStatus(slug: string): void {
    this.articleService.getLikeStatus(slug).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (status) => this.liked.set(status.liked),
      error: () => { /* non-critical */ },
    });
  }

  likeArticle(): void {
    const article = this.article();
    if (!article) return;
    // Q6.4: Prevent duplicate like requests
    if (this.likePending()) return;
    if (!this.authStore.isAuthenticated()) {
      this.notification.warning(this.i18n.t('blog.loginToLike'));
      return;
    }

    const prev = this.liked();
    const prevCount = article.likeCount;
    this.liked.set(!prev);
    this.likePending.set(true);
    this.article.set({ ...article, likeCount: prev ? prevCount - 1 : prevCount + 1 });

    this.articleService.likeArticle(article.slug).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.liked.set(response.liked);
        this.article.set({ ...this.article()!, likeCount: response.likeCount });
        this.likePending.set(false);
      },
      error: () => {
        this.liked.set(prev);
        this.article.set({ ...this.article()!, likeCount: prevCount });
        this.likePending.set(false);
        this.notification.error(this.i18n.t('blog.failedToLike'));
      },
    });
  }

  // Q8.2: Share methods delegated to utils/share.util.ts
  private get shareCtx() {
    return { platformId: this.platformId, article: this.article(), articleService: this.articleService, notification: this.notification, i18n: this.i18n };
  }

  shareArticle(): void {
    shareNative(this.shareCtx);
  }

  getInitials = getInitials;

  scrollToHeading(event: Event, id: string): void {
    event.preventDefault();
    if (!isPlatformBrowser(this.platformId)) return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  shareTwitter(): void {
    shareTwitterUtil(this.shareCtx);
  }

  shareLinkedIn(): void {
    shareLinkedInUtil(this.shareCtx);
  }

  shareFacebook(): void {
    shareFacebookUtil(this.shareCtx);
  }

  copyLink(): void {
    copyArticleLink(this.shareCtx);
  }

}
