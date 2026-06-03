import { Component, input, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ArticleSummaryResponse } from '../../../models';
import { BookmarkService } from '../../../core/services/bookmark.service';
import { getInitials } from '../../utils/string.utils';

@Component({
  selector: 'app-article-card',
  imports: [RouterLink, NgOptimizedImage],
  templateUrl: './article-card.component.html',
  styleUrl: './article-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleCardComponent {
  readonly bookmarkService = inject(BookmarkService);

  article = input.required<ArticleSummaryResponse>();

  toggleBookmark(event: Event): void {
    // Sits above the stretched title-link overlay; stop propagation so toggling a
    // bookmark never also triggers card navigation.
    event.stopPropagation();
    this.bookmarkService.toggle(this.article().slug);
  }

  getInitials = getInitials;
}
