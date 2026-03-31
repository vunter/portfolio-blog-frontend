/**
 * Q8.2: Extracted from ArticleDetailComponent to reduce file size.
 * Pure utility for social share actions.
 */
import { isPlatformBrowser } from '@angular/common';
import { ArticleService } from '../../../services/article.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { I18nService } from '../../../../../core/services/i18n.service';
import { ArticleResponse } from '../../../../../models';

interface ShareContext {
  platformId: object;
  article: ArticleResponse | null;
  articleService: ArticleService;
  notification: NotificationService;
  i18n: I18nService;
}

function openShareWindow(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer,width=600,height=400');
}

export function shareNative(ctx: ShareContext): void {
  if (!isPlatformBrowser(ctx.platformId)) return;
  const article = ctx.article;
  const shareUrl = ctx.articleService.buildShareUrl(window.location.href, 'native');
  if (navigator.share) {
    navigator.share({
      title: article?.title,
      url: shareUrl,
    }).then(() => ctx.articleService.trackShare(article?.id ? +article.id : undefined, 'native'))
      .catch(() => { /* user cancelled */ });
  } else {
    navigator.clipboard.writeText(shareUrl).catch(() => { /* clipboard not available */ });
    ctx.notification.success(ctx.i18n.t('blog.linkCopied'));
    ctx.articleService.trackShare(article?.id ? +article.id : undefined, 'native');
  }
}

export function shareTwitter(ctx: ShareContext): void {
  if (!isPlatformBrowser(ctx.platformId)) return;
  const article = ctx.article;
  const title = article?.title || '';
  const url = ctx.articleService.buildShareUrl(window.location.href, 'twitter');
  openShareWindow(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
  );
  ctx.articleService.trackShare(article?.id ? +article.id : undefined, 'twitter');
}

export function shareLinkedIn(ctx: ShareContext): void {
  if (!isPlatformBrowser(ctx.platformId)) return;
  const article = ctx.article;
  const url = ctx.articleService.buildShareUrl(window.location.href, 'linkedin');
  openShareWindow(
    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
  );
  ctx.articleService.trackShare(article?.id ? +article.id : undefined, 'linkedin');
}

export function shareFacebook(ctx: ShareContext): void {
  if (!isPlatformBrowser(ctx.platformId)) return;
  const article = ctx.article;
  const url = ctx.articleService.buildShareUrl(window.location.href, 'facebook');
  openShareWindow(
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
  );
  ctx.articleService.trackShare(article?.id ? +article.id : undefined, 'facebook');
}

export function copyArticleLink(ctx: ShareContext): void {
  if (!isPlatformBrowser(ctx.platformId)) return;
  const article = ctx.article;
  const url = ctx.articleService.buildShareUrl(window.location.href, 'clipboard');
  navigator.clipboard.writeText(url)
    .then(() => ctx.notification.success(ctx.i18n.t('blog.linkCopied')))
    .catch(() => ctx.notification.error(ctx.i18n.t('common.error')));
  ctx.articleService.trackShare(article?.id ? +article.id : undefined, 'clipboard');
}
