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
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MarkdownModule } from 'ngx-markdown';
// PERF-F-02: PrismJS is lazy-loaded only when article content is rendered,
// instead of being included in global scripts (which blocked initial page load).
// ngx-markdown auto-detects window.Prism for syntax highlighting.
import { ArticleService } from '../../services/article.service';
import { CommentService } from '../../services/comment.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { RecaptchaService } from '../../../../core/services/recaptcha.service';
import { SeoService } from '../../../../core/services/seo.service';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ArticleCardComponent } from '../../../../shared/components/article-card/article-card.component';
import { BreadcrumbsComponent, Breadcrumb } from '../../../../shared/components/breadcrumbs/breadcrumbs.component';
import { getInitials } from '../../../../shared/utils/string.utils';
import {
  ArticleResponse,
  ArticleSummaryResponse,
  CommentResponse,
} from '../../../../models';

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
    FormsModule,
    MarkdownModule,
    LoadingSpinnerComponent,
    ArticleCardComponent,
    BreadcrumbsComponent,
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
  private readonly commentService = inject(CommentService);
  private readonly notification = inject(NotificationService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recaptcha = inject(RecaptchaService);
  private readonly renderer = inject(Renderer2);
  private readonly elementRef = inject(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly seo = inject(SeoService);
  readonly i18n = inject(I18nService);

  readonly dateLocale = computed(() => {
    const lang = this.i18n.language();
    const map: Record<string, string> = { en: 'en-US', pt: 'pt-BR', es: 'es', it: 'it' };
    return map[lang] || 'en-US';
  });

  article = signal<ArticleResponse | null>(null);
  comments = signal<CommentResponse[]>([]);
  commentPage = signal(0);
  commentTotalElements = signal(0);
  hasMoreComments = signal(false);
  loadingMoreComments = signal(false);
  relatedArticles = signal<ArticleSummaryResponse[]>([]);
  loading = signal(true);
  liked = signal(false);

  // Comment form signals
  commentName = signal('');
  commentEmail = signal('');
  commentContent = signal('');
  submittingComment = signal(false);
  commentSubmitted = signal(false);

  // Reply form signals
  replyingTo = signal<CommentResponse | null>(null);
  replyParentId = signal<string | null>(null);
  replyName = signal('');
  replyContent = signal('');
  submittingReply = signal(false);

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
  // PERF-F-06: Store cleanup functions for event listeners to prevent memory leaks
  private readonly eventCleanups: Array<() => void> = [];
  // PERF-F-03: Bound reference for scroll listener cleanup
  private readonly boundScrollHandler = () => this.onWindowScroll();

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
        const text = match[2].replace(/[*_`\[\]]/g, '').trim();
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
      if (this.scrollThrottleTimer) {
        clearTimeout(this.scrollThrottleTimer);
        this.scrollThrottleTimer = null;
      }
      if (isPlatformBrowser(this.platformId)) {
        window.removeEventListener('scroll', this.boundScrollHandler);
      }
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
    // This runs only once per render cycle, not on every change detection
    effect(() => {
      const article = this.article();
      if (article && isPlatformBrowser(this.platformId)) {
        // Schedule DOM processing after Angular finishes rendering
        // Use requestAnimationFrame as afterNextRender only works in constructor context
        requestAnimationFrame(() => this.processArticleContent());
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

    // PERF-F-03: Register scroll listener outside Angular zone to prevent change detection
    // on every scroll event. The handler only updates signals when throttle timer fires.
    if (isPlatformBrowser(this.platformId)) {
      this.zone.runOutsideAngular(() => {
        window.addEventListener('scroll', this.boundScrollHandler, { passive: true });
      });
    }
  }

  // PERF-01: Extracted from ngAfterViewChecked — runs once after render, not every CD cycle
  // CRIT-01: Angular-native DOM manipulation using Renderer2 instead of direct DOM access
  private processArticleContent(): void {
    const hostEl = this.elementRef.nativeElement as HTMLElement;

    if (!this.headingsProcessed) {
      const contentEl = hostEl.querySelector('.article-content');
      if (contentEl) {
        const headings = contentEl.querySelectorAll('h2, h3');
        if (headings.length > 0) {
          headings.forEach((h) => {
            const text = (h.textContent || '').trim();
            const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            this.renderer.setAttribute(h, 'id', id);
          });
          this.headingsProcessed = true;
          this.setupHeadingObserver(headings);
        }
      }
    }

    // Add copy buttons to code blocks using Renderer2
    // PERF-F-06: Click handler references stored in eventCleanups, cleaned up via DestroyRef
    if (!this.codeBlocksProcessed) {
      const codeBlocks = hostEl.querySelectorAll('.article-content pre');
      if (codeBlocks.length > 0) {
        codeBlocks.forEach((pre) => {
          if (pre.querySelector('.code-copy-btn')) return;
          const wrapper = this.renderer.createElement('div');
          this.renderer.addClass(wrapper, 'code-block-wrapper');
          this.renderer.insertBefore(pre.parentNode, wrapper, pre);
          this.renderer.appendChild(wrapper, pre);

          const btn = this.renderer.createElement('button');
          this.renderer.addClass(btn, 'code-copy-btn');
          this.renderer.setAttribute(btn, 'title', this.i18n.t('blog.copyCode'));
          // F-337: Use Renderer2 instead of innerHTML to avoid bypassing Angular sanitization
          this.setCopyIcon(btn);
          // PERF-F-06: Store unlisten function for cleanup in ngOnDestroy
          const unlisten = this.renderer.listen(btn, 'click', () => {
            const code = pre.querySelector('code')?.textContent || pre.textContent || '';
            navigator.clipboard.writeText(code).then(() => {
              this.zone.run(() => {
                this.setCheckIcon(btn);
                this.notification.success(this.i18n.t('blog.codeCopied'));
                setTimeout(() => {
                  this.setCopyIcon(btn);
                }, 2000);
              });
            }).catch(() => {
              this.zone.run(() => {
                this.notification.error(this.i18n.t('blog.copyFailed'));
              });
            });
          });
          this.eventCleanups.push(unlisten);
          this.renderer.appendChild(wrapper, btn);
        });
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

  private scrollThrottleTimer: ReturnType<typeof setTimeout> | null = null;

  onWindowScroll(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.scrollThrottleTimer) return;
    this.scrollThrottleTimer = setTimeout(() => {
      this.scrollThrottleTimer = null;
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      this.readingProgress.set(docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0);
    }, 60);
  }

  loadArticle(slug: string): void {
    this.loading.set(true);
    this.headingsProcessed = false;
    this.codeBlocksProcessed = false;

    this.articleService.getArticleBySlug(slug).subscribe({
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
        this.loadComments(slug);
        this.loadRelatedArticles(slug);
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
    this.articleService.trackView(slug).subscribe({
      error: () => { /* view tracking is non-critical */ }
    });
  }

  loadComments(slug: string): void {
    this.commentPage.set(0);
    this.commentService.getCommentsPaged(slug, 0, 20).subscribe({
      next: (response) => {
        this.comments.set(response.content ?? []);
        this.commentTotalElements.set(response.totalElements);
        this.hasMoreComments.set(response.page < response.totalPages - 1);
        this.commentPage.set(response.page);
      },
      error: () => {
        this.comments.set([]);
        this.commentTotalElements.set(0);
        this.hasMoreComments.set(false);
      },
    });
  }

  loadMoreComments(): void {
    const slug = this.currentSlug;
    if (!slug || this.loadingMoreComments()) return;
    this.loadingMoreComments.set(true);
    const nextPage = this.commentPage() + 1;
    this.commentService.getCommentsPaged(slug, nextPage, 20).subscribe({
      next: (response) => {
        this.comments.update(prev => [...prev, ...(response.content ?? [])]);
        this.commentPage.set(response.page);
        this.hasMoreComments.set(response.page < response.totalPages - 1);
        this.loadingMoreComments.set(false);
      },
      error: () => {
        this.loadingMoreComments.set(false);
      },
    });
  }

  loadRelatedArticles(slug: string): void {
    this.articleService.getRelatedArticles(slug).subscribe({
      next: (articles) => this.relatedArticles.set(articles),
      error: () => this.relatedArticles.set([]),
    });
  }

  likeArticle(): void {
    const article = this.article();
    if (!article) return;

    this.articleService.likeArticle(article.slug).subscribe({
      next: (response) => {
        this.article.set({ ...article, likeCount: response.likeCount });
        this.liked.set(true);
      },
      error: () => {
        this.notification.error(this.i18n.t('blog.failedToLike'));
      },
    });
  }

  shareArticle(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (navigator.share) {
      navigator.share({
        title: this.article()?.title,
        url: window.location.href,
      }).catch(() => { /* user cancelled or not supported */ });
    } else {
      navigator.clipboard.writeText(window.location.href).catch(() => { /* clipboard not available */ });
      this.notification.success(this.i18n.t('blog.linkCopied'));
    }
  }

  submitComment(): void {
    const article = this.article();
    const name = this.commentName().trim();
    const content = this.commentContent().trim();
    const email = this.commentEmail().trim();

    if (!article || !name || content.length < 10) return;

    this.submittingComment.set(true);
    this.commentSubmitted.set(false);

    this.recaptcha.execute('comment').then(recaptchaToken => {
      this.commentService
        .createComment(article.slug, {
          content,
          authorName: name,
          authorEmail: email || undefined,
          recaptchaToken: recaptchaToken ?? undefined,
        })
        .subscribe({
          next: () => {
            this.commentName.set('');
            this.commentEmail.set('');
            this.commentContent.set('');
            this.submittingComment.set(false);
            this.commentSubmitted.set(true);
          },
          error: () => {
            this.submittingComment.set(false);
            this.notification.error(this.i18n.t('blog.failedToComment'));
          },
        });
    }).catch(() => {
      this.submittingComment.set(false);
      this.notification.error(this.i18n.t('blog.failedToComment'));
    });
  }

  startReply(comment: CommentResponse, rootParentId?: string): void {
    this.replyingTo.set(comment);
    this.replyParentId.set(rootParentId || comment.id);
    this.replyName.set(this.commentName());
    this.replyContent.set('');
  }

  cancelReply(): void {
    this.replyingTo.set(null);
    this.replyParentId.set(null);
    this.replyContent.set('');
  }

  submitReply(): void {
    const article = this.article();
    const parentId = this.replyParentId();
    if (!article || !parentId) return;

    const name = this.replyName().trim();
    const content = this.replyContent().trim();
    if (!name || content.length < 10) return;

    this.submittingReply.set(true);

    this.recaptcha.execute('comment').then(recaptchaToken => {
      this.commentService
        .createComment(article.slug, {
          authorName: name,
          content,
          parentId,
          recaptchaToken: recaptchaToken ?? undefined,
        })
        .subscribe({
          next: () => {
            this.submittingReply.set(false);
            this.cancelReply();
            this.notification.success(this.i18n.t('article.comments.pending'));
          },
          error: () => {
            this.submittingReply.set(false);
            this.notification.error(this.i18n.t('blog.failedToComment'));
          },
        });
    }).catch(() => {
      this.submittingReply.set(false);
      this.notification.error(this.i18n.t('blog.failedToComment'));
    });
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
    if (!isPlatformBrowser(this.platformId)) return;
    const title = this.article()?.title || '';
    const url = window.location.href;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer,width=600,height=400'
    );
  }

  shareLinkedIn(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = window.location.href;
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer,width=600,height=400'
    );
  }

  shareFacebook(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = window.location.href;
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer,width=600,height=400'
    );
  }

  copyLink(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    navigator.clipboard.writeText(window.location.href)
      .then(() => this.notification.success(this.i18n.t('blog.linkCopied')))
      .catch(() => this.notification.error(this.i18n.t('common.error')));
  }

  // F-337: SVG icon helpers using Renderer2 instead of innerHTML
  private createSvg(children: Array<{tag: string; attrs: Record<string, string>}>): SVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.renderer.setAttribute(svg, 'width', '14');
    this.renderer.setAttribute(svg, 'height', '14');
    this.renderer.setAttribute(svg, 'viewBox', '0 0 24 24');
    this.renderer.setAttribute(svg, 'fill', 'none');
    this.renderer.setAttribute(svg, 'stroke', 'currentColor');
    this.renderer.setAttribute(svg, 'stroke-width', '2');
    for (const child of children) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', child.tag);
      for (const [attr, val] of Object.entries(child.attrs)) {
        this.renderer.setAttribute(el, attr, val);
      }
      this.renderer.appendChild(svg, el);
    }
    return svg;
  }

  private setCopyIcon(btn: HTMLElement): void {
    while (btn.firstChild) btn.removeChild(btn.firstChild);
    this.renderer.appendChild(btn, this.createSvg([
      { tag: 'rect', attrs: { x: '9', y: '9', width: '13', height: '13', rx: '2' } },
      { tag: 'path', attrs: { d: 'M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1' } },
    ]));
  }

  private setCheckIcon(btn: HTMLElement): void {
    while (btn.firstChild) btn.removeChild(btn.firstChild);
    this.renderer.appendChild(btn, this.createSvg([
      { tag: 'polyline', attrs: { points: '20 6 9 17 4 12' } },
    ]));
  }
}
