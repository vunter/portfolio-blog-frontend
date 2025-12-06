import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
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
   */
  private clearFunctionalStorage(): void {
    const functionalKeys = ['theme', 'preferred_locale', 'sidebar_collapsed'];
    for (const key of functionalKeys) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
  }
}
