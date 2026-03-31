import { Injectable, inject, PLATFORM_ID, DestroyRef, isDevMode } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CookieConsentService } from './cookie-consent.service';
import { AnalyticsSecurityService } from './analytics-security.service';
import { RecaptchaService } from './recaptcha.service';
import { EMPTY, Observable, catchError, from, switchMap } from 'rxjs';

export interface AnalyticsEvent {
  articleId?: number;
  eventType: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
}

interface SecuredAnalyticsPayload extends AnalyticsEvent {
  recaptchaToken?: string | null;
  challengeId?: string;
  solution?: string;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsTrackingService {
  private http = inject(HttpClient);
  private consent = inject(CookieConsentService);
  private platformId = inject(PLATFORM_ID);
  private security = inject(AnalyticsSecurityService);
  private recaptcha = inject(RecaptchaService);
  private destroyRef = inject(DestroyRef);

  // Time-on-page tracking state
  private pageEntryTime = 0;
  private accumulatedTime = 0;
  private isPageVisible = true;
  private visibilityHandler: (() => void) | null = null;
  private initialized = false;

  /** Check if analytics consent is given */
  hasConsent(): boolean {
    return this.consent.hasConsent('analytics');
  }

  /**
   * Initialize security tokens after consent is granted.
   * Pre-fetches token and pre-solves a PoW challenge for instant use.
   */
  initSecurity(): void {
    if (!isPlatformBrowser(this.platformId) || !this.hasConsent() || this.initialized) return;
    this.initialized = true;
    // Pre-fetch token and pre-solve challenge in background
    this.security.getToken().catch(() => {});
    this.security.preSolveChallenge();
  }

  /** Track a generic analytics event with all security layers. No-ops if no consent. */
  track(event: AnalyticsEvent): void {
    if (!this.hasConsent()) return;
    this.initSecurity();

    from(this.buildSecuredRequest(event)).pipe(
      switchMap(({ payload, headers }) =>
        this.http.post<void>('/api/v1/analytics/event', payload, { headers })
      ),
      catchError((err) => {
        if (isDevMode()) {
          console.warn('[Analytics] Error:', err);
        }
        return EMPTY;
      })
    ).subscribe();
  }

  /** Track an article view by slug. Consent-gated. Simplified path (no PoW/token). */
  trackArticleView(slug: string): Observable<void> {
    if (!this.hasConsent()) return EMPTY;
    const headers = new HttpHeaders({ 'X-Analytics-Consent': 'granted' });
    return this.http.post<void>(`/api/v1/analytics/view/${slug}`, null, { headers })
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
    if (!this.hasConsent()) return;
    this.track({
      eventType: 'CLICK',
      metadata: { url, type: 'outbound', label: label || '' },
    });
  }

  /** Track file downloads. */
  trackDownload(fileName: string, fileType: string): void {
    if (!this.hasConsent()) return;
    this.track({
      eventType: 'DOWNLOAD',
      metadata: { file: fileName, type: fileType },
    });
  }

  /** Track scroll depth at a specific threshold. */
  trackScrollDepth(depth: number, articleId?: number): void {
    if (!this.hasConsent()) return;
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

    // Safety: clean up listener if service is destroyed
    this.destroyRef.onDestroy(() => {
      if (this.visibilityHandler) {
        document.removeEventListener('visibilitychange', this.visibilityHandler);
        this.visibilityHandler = null;
      }
    });
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
   * Uses pre-cached security tokens when available; falls back gracefully.
   */
  trackBeacon(event: AnalyticsEvent): void {
    if (!this.hasConsent() || !isPlatformBrowser(this.platformId)) return;

    this.buildSecuredRequest(event).then(({ payload, headers }) => {
      const url = '/api/v1/analytics/event';
      const headerRecord: Record<string, string> = { 'Content-Type': 'application/json' };
      headers.keys().forEach(key => {
        const val = headers.get(key);
        if (val) headerRecord[key] = val;
      });

      fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: headerRecord,
        keepalive: true,
      }).catch(() => {});
    }).catch(() => {});
  }

  /**
   * Build a secured analytics request with all security layers:
   * 1. Session token (X-Analytics-Token header)
   * 2. Proof-of-work (challengeId + solution in body)
   * 3. reCAPTCHA v3 token (recaptchaToken in body)
   */
  private async buildSecuredRequest(event: AnalyticsEvent): Promise<{
    payload: SecuredAnalyticsPayload;
    headers: HttpHeaders;
  }> {
    // Fetch all security artifacts in parallel
    const [token, challenge, recaptchaToken] = await Promise.all([
      this.security.getToken().catch(() => null),
      this.security.getSolvedChallenge().catch(() => null),
      this.recaptcha.execute('analytics_event').catch(() => null),
    ]);

    const payload: SecuredAnalyticsPayload = {
      ...event,
      recaptchaToken: recaptchaToken ?? undefined,
      challengeId: challenge?.challengeId,
      solution: challenge?.solution,
    };

    let headers = new HttpHeaders({ 'X-Analytics-Consent': 'granted' });
    if (token) {
      headers = headers.set('X-Analytics-Token', token);
    }

    return { payload, headers };
  }
}
