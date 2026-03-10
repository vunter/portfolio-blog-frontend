import { Component, input, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
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
  private router = inject(Router);
  readonly bookmarkService = inject(BookmarkService);

  article = input.required<ArticleSummaryResponse>();

  navigateToArticle(): void {
    this.router.navigate(['/blog', this.article().slug]);
  }

  toggleBookmark(event: Event): void {
    event.stopPropagation();
    this.bookmarkService.toggle(this.article().slug);
  }

  getInitials = getInitials;
}
