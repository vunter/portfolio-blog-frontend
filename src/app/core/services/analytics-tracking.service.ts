import { Injectable, inject, PLATFORM_ID, DestroyRef, isDevMode } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CookieConsentService } from './cookie-consent.service';
import { AnalyticsSecurityService } from './analytics-security.service';
import { RecaptchaService } from './recaptcha.service';
import { EMPTY, Observable, Subject, catchError, from, mergeMap, switchMap } from 'rxjs';

export interface AnalyticsEvent {
  // AUD19C-02: Snowflake id — sent as the original string; a Number() round-trip
  // corrupts ids above 2^53 (the backend coerces string ids in bodies).
  articleId?: string;
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

  // Back-pressure: queue analytics events through a Subject with bounded concurrency
  private readonly trackQueue$ = new Subject<AnalyticsEvent>();

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
    this.trackQueue$.next(event);
  }

  /**
   * Record an article view by slug. Hits the canonical article-view endpoint, which
   * increments the public `views_count`, records reading history for authenticated
   * users, and (only when analytics consent is granted, signalled via the header)
   * records an analytics VIEW event. The view-count increment itself is an anonymous
   * aggregate and runs for every visitor, so this is intentionally NOT consent-gated.
   */
  trackArticleView(slug: string): Observable<void> {
    let headers = new HttpHeaders();
    if (this.hasConsent()) {
      headers = headers.set('X-Analytics-Consent', 'granted');
    }
    return this.http.post<void>(`/api/v1/articles/${slug}/view`, null, { headers })
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

  // Web-vitals observers are tracked here so they are explicitly disconnected on
  // service teardown even if the page is never hidden (each per-handler disconnect
  // only fires on visibilitychange / page-hide).
  private readonly webVitalObservers: PerformanceObserver[] = [];

  /**
   * Q13.4: Collect Core Web Vitals (LCP, CLS, INP) via PerformanceObserver.
   * Reports once per page load. Consent-gated.
   */
  trackWebVitals(): void {
    if (!isPlatformBrowser(this.platformId) || !this.hasConsent()) return;
    if (typeof PerformanceObserver === 'undefined') return;

    // LCP — Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
        if (last) {
          this.track({ eventType: 'WEB_VITAL', metadata: { metric: 'LCP', value: Math.round(last.startTime) } });
        }
        lcpObserver.disconnect();
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      this.webVitalObservers.push(lcpObserver);
    } catch { /* unsupported */ }

    // CLS — Cumulative Layout Shift
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { hadRecentInput: boolean; value: number })[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      this.webVitalObservers.push(clsObserver);
      // Report CLS on page hide
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && clsValue > 0) {
          this.trackBeacon({ eventType: 'WEB_VITAL', metadata: { metric: 'CLS', value: Math.round(clsValue * 1000) } });
          clsObserver.disconnect();
        }
      }, { once: true });
    } catch { /* unsupported */ }

    // INP — Interaction to Next Paint (replaces FID)
    try {
      let maxInp = 0;
      const inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { duration: number })[]) {
          if (entry.duration > maxInp) maxInp = entry.duration;
        }
      });
      inpObserver.observe({ type: 'event', buffered: true });
      this.webVitalObservers.push(inpObserver);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && maxInp > 0) {
          this.trackBeacon({ eventType: 'WEB_VITAL', metadata: { metric: 'INP', value: maxInp } });
          inpObserver.disconnect();
        }
      }, { once: true });
    } catch { /* unsupported */ }
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
  trackScrollDepth(depth: number, articleId?: string): void {
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

    // Clean up previous listener before registering a new one (prevents accumulation on re-navigation)
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

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

  constructor() {
    // Process analytics events with bounded concurrency (max 3 in-flight requests)
    this.trackQueue$.pipe(
      mergeMap(event =>
        from(this.buildSecuredRequest(event)).pipe(
          switchMap(({ payload, headers }) =>
            this.http.post<void>('/api/v1/analytics/event', payload, { headers })
          ),
          catchError((err) => {
            // 403 = the server no longer recognizes our token (Redis restart,
            // failover, flush). Drop the cache so the NEXT event fetches a
            // fresh one instead of replaying the dead token until expiry.
            if (err?.status === 403) {
              this.security.invalidateToken();
            }
            if (isDevMode()) {
              console.warn('[Analytics] Error:', err);
            }
            return EMPTY;
          }),
        ),
        3, // max 3 concurrent HTTP requests
      ),
    ).subscribe();

    // Single cleanup registration: remove listener when the service's injector is destroyed
    this.destroyRef.onDestroy(() => {
      if (this.visibilityHandler) {
        document.removeEventListener('visibilitychange', this.visibilityHandler);
        this.visibilityHandler = null;
      }
      this.webVitalObservers.forEach(o => o.disconnect());
      this.webVitalObservers.length = 0;
      this.trackQueue$.complete();
    });
  }

  /** Stop time tracking and send the duration event. */
  stopTimeTracking(articleId?: string, page?: string): void {
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

      // This raw fetch() bypasses Angular's HttpClient XSRF interceptor, so attach
      // the X-XSRF-TOKEN header manually to keep the beacon endpoint behind the same
      // CSRF protection as every other mutation request.
      const xsrf = this.readXsrfToken();
      if (xsrf) headerRecord['X-XSRF-TOKEN'] = xsrf;

      fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: headerRecord,
        keepalive: true,
        credentials: 'same-origin',
      }).catch(() => {});
    }).catch(() => {});
  }

  /** Read the Angular/Spring XSRF-TOKEN cookie value (browser-only). */
  private readXsrfToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
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
