import { Component, inject, input, output, signal, ChangeDetectionStrategy, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { AdminApiService } from '../../../../services/admin-api.service';
import { I18nService } from '../../../../../../core/services/i18n.service';
import { ArticleReview } from '../../../../../../models';

@Component({
  selector: 'app-article-review-panel',
  imports: [DatePipe],
  templateUrl: './article-review-panel.component.html',
  styleUrl: './article-review-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleReviewPanelComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(I18nService);

  articleId = input.required<string>();
  originalStatus = input<string>('');

  changesRequested = output<string>();

  reviewHistory = signal<ArticleReview[]>([]);
  feedbackText = signal('');
  // AUD18-05: distinguish a failed load from an empty history
  loadError = signal(false);

  ngOnInit(): void {
    this.loadReviewHistory();
  }

  loadReviewHistory(): void {
    this.loadError.set(false);
    this.adminApi.getArticleReviews(this.articleId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (reviews) => this.reviewHistory.set(reviews),
      // AUD18-05: previously subscribe({next}) had no error branch, so a failed
      // load was indistinguishable from "no reviews yet".
      error: () => this.loadError.set(true),
    });
  }

  requestChanges(): void {
    this.changesRequested.emit(this.feedbackText());
  }
}
