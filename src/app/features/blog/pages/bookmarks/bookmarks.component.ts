import { Component, inject, signal, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BookmarkService } from '../../../../core/services/bookmark.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ArticleCardComponent } from '../../../../shared/components/article-card/article-card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ArticleResponse } from '../../../../models';

@Component({
  selector: 'app-bookmarks',
  imports: [ArticleCardComponent, EmptyStateComponent],
  template: `
    <section class="bookmarks-page">
      <h1 class="bookmarks-page__title">{{ i18n.t('bookmarks.title') }}</h1>
      <p class="bookmarks-page__subtitle">{{ i18n.t('bookmarks.subtitle') }}</p>

      @if (loading()) {
        <div class="bookmarks-page__loading">
          <div class="spinner"></div>
        </div>
      } @else if (articles().length === 0) {
        <app-empty-state
          [title]="i18n.t('bookmarks.emptyTitle')"
          [message]="i18n.t('bookmarks.emptyMessage')"
        />
      } @else {
        <div class="bookmarks-page__grid">
          @for (article of articles(); track article.id) {
            <app-article-card [article]="article" />
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .bookmarks-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1rem;

      &__title {
        font-size: 1.75rem;
        font-weight: 700;
        margin-bottom: 0.25rem;
      }

      &__subtitle {
        color: var(--text-secondary, #6b7280);
        margin-bottom: 2rem;
      }

      &__loading {
        display: flex;
        justify-content: center;
        padding: 4rem 0;
      }

      &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 1.5rem;
      }
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border-color, #e5e7eb);
      border-top-color: var(--color-accent, #3b82f6);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookmarksComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly bookmarkService = inject(BookmarkService);
  readonly i18n = inject(I18nService);

  articles = signal<ArticleResponse[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.loadBookmarks();
  }

  private loadBookmarks(): void {
    this.loading.set(true);
    this.bookmarkService.fetchBookmarkedArticles(0, 50)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.articles.set(response.content as ArticleResponse[]);
          this.loading.set(false);
        },
        error: () => {
          this.articles.set([]);
          this.loading.set(false);
        },
      });
  }
}
