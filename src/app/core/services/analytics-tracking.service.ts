import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CookieConsentService } from './cookie-consent.service';
import { EMPTY, Observable, catchError } from 'rxjs';

export interface AnalyticsEvent {
  articleId?: number;
  eventType: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsTrackingService {
  private http = inject(HttpClient);
  private consent = inject(CookieConsentService);
  private platformId = inject(PLATFORM_ID);

  private readonly analyticsHeaders = new HttpHeaders({
    'X-Analytics-Consent': 'granted',
  });

  // Time-on-page tracking state
  private pageEntryTime = 0;
  private accumulatedTime = 0;
  private isPageVisible = true;
  private visibilityHandler: (() => void) | null = null;

  /** Check if analytics consent is given */
  hasConsent(): boolean {
    return this.consent.hasConsent('analytics');
  }

  /** Track a generic analytics event. No-ops if analytics consent not given. */
  track(event: AnalyticsEvent): void {
    if (!this.hasConsent()) return;
    this.http.post<void>('/api/v1/analytics/event', event, { headers: this.analyticsHeaders })
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }

  /** Track an article view by slug. Consent-gated. */
  trackArticleView(slug: string): Observable<void> {
    if (!this.hasConsent()) return EMPTY;
    return this.http.post<void>(`/api/v1/analytics/view/${slug}`, null, { headers: this.analyticsHeaders })
      .pipe(catchError(() => EMPTY));
  }

  /** Track page view for non-article pages. */
  trackPageView(page: string, title?: string): void {
    if (!this.hasConsent()) return;
    this.track({
      eventType: 'PAGE_VIEW',
      metadata: { page, title: title || '' },
    });
  }

  /** Track outbound link clicks. */
  trackOutboundClick(url: string, label?: string): void {
    this.track({
      eventType: 'CLICK',
      metadata: { url, type: 'outbound', label: label || '' },
    });
  }

  /** Track file downloads. */
  trackDownload(fileName: string, fileType: string): void {
    this.track({
      eventType: 'DOWNLOAD',
      metadata: { file: fileName, type: fileType },
    });
  }

  /** Track scroll depth at a specific threshold. */
  trackScrollDepth(depth: number, articleId?: number): void {
    this.track({
      articleId,
      eventType: 'SCROLL_DEPTH',
      metadata: { depth },
    });
  }

  /** Start time-on-page tracking with visibility-aware timer. */
  startTimeTracking(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.pageEntryTime = Date.now();
    this.accumulatedTime = 0;
    this.isPageVisible = true;

    this.visibilityHandler = () => {
      if (document.hidden) {
        this.accumulatedTime += Date.now() - this.pageEntryTime;
        this.isPageVisible = false;
      } else {
        this.pageEntryTime = Date.now();
        this.isPageVisible = true;
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /** Stop time tracking and send the duration event. */
  stopTimeTracking(articleId?: number, page?: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    if (this.isPageVisible) {
      this.accumulatedTime += Date.now() - this.pageEntryTime;
    }

    const durationSeconds = Math.round(this.accumulatedTime / 1000);
    if (durationSeconds >= 3) {
      this.trackBeacon({
        articleId,
        eventType: 'TIME_ON_PAGE',
        metadata: { duration_seconds: durationSeconds, ...(page ? { page } : {}) },
      });
    }
  }

  /**
   * Track using fetch with keepalive for reliable delivery on page unload.
   * sendBeacon cannot include custom headers, so we use fetch keepalive instead.
   */
  trackBeacon(event: AnalyticsEvent): void {
    if (!this.hasConsent() || !isPlatformBrowser(this.platformId)) return;
    const url = '/api/v1/analytics/event';
    const body = JSON.stringify(event);
    fetch(url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json', 'X-Analytics-Consent': 'granted' },
      keepalive: true,
    }).catch(() => {});
  }
}
