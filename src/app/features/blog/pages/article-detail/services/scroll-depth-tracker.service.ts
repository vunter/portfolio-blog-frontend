import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../../../../environments/environment';
import { AnalyticsTrackingService } from '../../../../../core/services/analytics-tracking.service';

/**
 * Manages IntersectionObserver-based scroll depth tracking with sentinel elements.
 * Extracted from ArticleDetailComponent (Q7.1).
 */
@Injectable({ providedIn: 'root' })
export class ScrollDepthTrackerService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly analytics = inject(AnalyticsTrackingService);
  private observer: IntersectionObserver | null = null;
  private firedThresholds = new Set<number>();

  /**
   * Init scroll depth tracking on the given article content element.
   * Creates sentinel divs at configured threshold percentages.
   */
  init(articleId: string | undefined): void {
    if (!isPlatformBrowser(this.platformId) || !this.analytics.hasConsent()) return;
    this.destroy();

    requestAnimationFrame(() => {
      const articleBody = document.querySelector('.article-content') as HTMLElement;
      if (!articleBody) return;

      // Clean any existing sentinels
      articleBody.querySelectorAll('[data-scroll-threshold]').forEach(el => el.remove());

      const position = getComputedStyle(articleBody).position;
      if (position === 'static') {
        articleBody.style.position = 'relative';
      }

      const thresholds = environment.scrollDepthThresholds;
      const sentinels: HTMLElement[] = [];

      thresholds.forEach(threshold => {
        const sentinel = document.createElement('div');
        sentinel.dataset['scrollThreshold'] = threshold.toString();
        sentinel.style.cssText = 'height:1px;width:100%;position:absolute;pointer-events:none;opacity:0;';
        sentinel.style.top = `${threshold}%`;
        articleBody.appendChild(sentinel);
        sentinels.push(sentinel);
      });

      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const threshold = parseInt(entry.target.getAttribute('data-scroll-threshold') || '0', 10);
            if (threshold && !this.firedThresholds.has(threshold)) {
              this.firedThresholds.add(threshold);
              this.analytics.trackScrollDepth(threshold, articleId);
            }
          }
        });
      }, { threshold: 0.1 });

      sentinels.forEach(s => this.observer!.observe(s));
    });
  }

  destroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.firedThresholds.clear();
  }
}
