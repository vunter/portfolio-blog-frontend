import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type CookieCategory = 'necessary' | 'functional' | 'analytics';

export interface CookieConsent {
  necessary: boolean; // Always true — can't be disabled
  functional: boolean;
  analytics: boolean;
  timestamp: number;
}

const CONSENT_KEY = 'cookie_consent';
const DEFAULT_CONSENT: CookieConsent = {
  necessary: true,
  functional: false,
  analytics: false,
  timestamp: 0,
};

@Injectable({ providedIn: 'root' })
export class CookieConsentService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Whether the consent banner should be shown */
  readonly showBanner = signal(false);

  /** Current consent state */
  readonly consent = signal<CookieConsent>({ ...DEFAULT_CONSENT });

  constructor() {
    if (!this.isBrowser) return;

    const stored = this.loadConsent();
    if (stored) {
      this.consent.set(stored);
      this.showBanner.set(false);
    } else {
      this.showBanner.set(true);
    }
  }

  /** Accept all cookie categories */
  acceptAll(): void {
    this.saveConsent({ necessary: true, functional: true, analytics: true, timestamp: Date.now() });
  }

  /** Reject all optional cookies (keep only necessary) */
  rejectOptional(): void {
    this.saveConsent({ necessary: true, functional: false, analytics: false, timestamp: Date.now() });
  }

  /** Save custom preferences */
  savePreferences(functional: boolean, analytics: boolean): void {
    this.saveConsent({ necessary: true, functional, analytics, timestamp: Date.now() });
  }

  /** Check if consent is given for a specific category */
  hasConsent(category: CookieCategory): boolean {
    if (category === 'necessary') return true;
    return this.consent()[category];
  }

  /**
   * Q14.4: List of feature categories that are degraded due to denied consent.
   * Empty when all consent categories are accepted.
   */
  readonly degradedCategories = computed<CookieCategory[]>(() => {
    const c = this.consent();
    const degraded: CookieCategory[] = [];
    if (!c.functional) degraded.push('functional');
    if (!c.analytics) degraded.push('analytics');
    return degraded;
  });

  /** Whether any optional consent category is denied */
  readonly hasDegradation = computed(() => this.degradedCategories().length > 0);

  /** Re-open the banner (e.g. from a footer "Cookie Settings" link) */
  reopenBanner(): void {
    this.showBanner.set(true);
  }

  private saveConsent(consent: CookieConsent): void {
    consent.necessary = true; // Always enforce
    this.consent.set(consent);
    this.showBanner.set(false);

    if (this.isBrowser) {
      try {
        localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
      } catch {
        // storage unavailable
      }

      // Clean up functional storage if consent revoked
      if (!consent.functional) {
        this.clearFunctionalStorage();
      }
    }
  }

  private loadConsent(): CookieConsent | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.necessary === 'boolean') {
        return { ...DEFAULT_CONSENT, ...parsed, necessary: true };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Clear non-essential localStorage/sessionStorage items when functional consent is revoked.
   * We only clear known preference keys — we never touch auth-related items.
   *
   * AUD18-M27: the previous list cleared only 'preferred_locale' (written by nothing) and
   * 'sidebar_collapsed' (the real key is 'admin_sidebar_collapsed'), so every actual
   * functional-category key survived revocation. The list below matches what the app
   * really stores under functional consent (see the /cookies policy page):
   * - 'app-language'            i18n language preference (I18nService)
   * - 'app-theme'               theme preference (ThemeService)
   * - 'admin_sidebar_collapsed' admin sidebar state (AdminLayoutComponent)
   * - 'visitor-id'              bookmark-sync visitor id — created by BookmarkService only
   *                             when functional consent is granted, so it is functional
   *                             (NOT analytics) data in this app
   * - 'bookmarked-articles'     bookmark slugs — BookmarkService.persist() only writes this
   *                             under functional consent, so revoking functional consent
   *                             clears the local copy (server-side bookmarks keyed by the
   *                             visitor id become unreachable once the id is cleared)
   * Analytics revocation needs no storage cleanup: AnalyticsTrackingService keeps no
   * client-side state (events are consent-gated at send time).
   * The two legacy keys stay in the list to scrub stale data from older visitors.
   */
  private clearFunctionalStorage(): void {
    const functionalKeys = [
      'app-language',
      'app-theme',
      'admin_sidebar_collapsed',
      'visitor-id',
      'bookmarked-articles',
      // Legacy keys (no longer written) — kept for cleanup of old visitors' storage
      'preferred_locale',
      'sidebar_collapsed',
    ];
    for (const key of functionalKeys) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
  }
}
