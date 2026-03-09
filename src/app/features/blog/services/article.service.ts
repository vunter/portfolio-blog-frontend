import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { I18nService } from '../../../core/services/i18n.service';
import { AnalyticsTrackingService } from '../../../core/services/analytics-tracking.service';
import {
  PageResponse,
  ArticleResponse,
  ArticleSummaryResponse,
} from '../../../models';

@Injectable({ providedIn: 'root' })
export class ArticleService {
  private api = inject(ApiService);
  private i18n = inject(I18nService);
  private analytics = inject(AnalyticsTrackingService);

  getArticles(
    page = 0,
    size = 10,
    dateFrom?: string,
    dateTo?: string,
    search?: string
  ): Observable<PageResponse<ArticleSummaryResponse>> {
    const locale = this.getLocale();
    const params: Record<string, string | number> = { page, size, locale };
    if (dateFrom) params['dateFrom'] = dateFrom;
    if (dateTo) params['dateTo'] = dateTo;
    if (search) params['search'] = search;
    return this.api.get<PageResponse<ArticleSummaryResponse>>('/articles', params);
  }

  getPopularArticles(limit = 5): Observable<PageResponse<ArticleSummaryResponse>> {
    const locale = this.getLocale();
    return this.api.get<PageResponse<ArticleSummaryResponse>>('/articles', { page: 0, size: limit, sort: 'viewCount,desc', locale });
  }

  getArticleBySlug(slug: string): Observable<ArticleResponse> {
    const locale = this.getLocale();
    return this.api.get<ArticleResponse>(`/articles/${slug}`, { locale });
  }

  getArticlesByTag(
    tagSlug: string,
    page = 0,
    size = 10
  ): Observable<PageResponse<ArticleSummaryResponse>> {
    const locale = this.getLocale();
    return this.api.get<PageResponse<ArticleSummaryResponse>>(
      `/articles/tag/${tagSlug}`,
      { page, size, locale }
    );
  }

  getRelatedArticles(
    slug: string,
    limit = 3
  ): Observable<ArticleSummaryResponse[]> {
    const locale = this.getLocale();
    return this.api.get<ArticleSummaryResponse[]>(
      `/articles/${slug}/related`,
      { limit, locale }
    );
  }

  trackView(slug: string): Observable<void> {
    return this.analytics.trackArticleView(slug);
  }

  trackShare(articleId: number | undefined, platform: string): void {
    this.analytics.track({
      articleId,
      eventType: 'SHARE',
      metadata: { platform },
    });
  }

  trackUtmView(articleId: number | undefined, metadata: Record<string, string>): void {
    this.analytics.track({
      articleId,
      eventType: 'VIEW',
      referrer: metadata['utm_source'],
      metadata,
    });
  }

  buildShareUrl(baseUrl: string, platform: string): string {
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}utm_source=${platform}&utm_medium=social&utm_campaign=blog_share`;
  }

  likeArticle(slug: string): Observable<{ likeCount: number; liked: boolean }> {
    return this.api.post<{ likeCount: number; liked: boolean }>(`/articles/${slug}/like`);
  }

  getLikeStatus(slug: string): Observable<{ likeCount: number; liked: boolean }> {
    return this.api.get<{ likeCount: number; liked: boolean }>(`/articles/${slug}/like/status`);
  }

  private getLocale(): string {
    const lang = this.i18n.language();
    return lang === 'pt' ? 'pt-br' : lang;
  }
}
