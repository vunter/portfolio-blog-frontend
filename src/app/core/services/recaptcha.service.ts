import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

/**
 * Service for Google reCAPTCHA v3 integration.
 *
 * Loads the reCAPTCHA script lazily on first use and provides
 * a method to execute reCAPTCHA for a given action.
 *
 * When reCAPTCHA is not configured (no site key), all methods
 * resolve with null tokens, allowing the backend to skip verification.
 */
@Injectable({ providedIn: 'root' })
export class RecaptchaService {
  private readonly platformId = inject(PLATFORM_ID);
  private scriptLoaded = false;
  private scriptLoading: Promise<void> | null = null;

  private get siteKey(): string {
    return environment.recaptchaSiteKey || '';
  }

  get isEnabled(): boolean {
    return !!(this.siteKey && environment.recaptchaEnabled !== false);
  }

  /**
   * Execute reCAPTCHA v3 for a given action and return the token.
   * Returns null if reCAPTCHA is not configured or not in browser.
   */
  async execute(action: string): Promise<string | null> {
    if (!isPlatformBrowser(this.platformId) || !this.isEnabled) {
      return null;
    }

    await this.loadScript();

    return new Promise<string | null>((resolve) => {
      const recaptchaEnterprise = window.grecaptcha?.enterprise;
      if (!recaptchaEnterprise) {
        // CQ-07: reCAPTCHA unavailable — resolve null silently
        resolve(null);
        return;
      }

      recaptchaEnterprise.ready(() => {
        recaptchaEnterprise
          .execute(this.siteKey, { action })
          .then((token) => resolve(token))
          .catch(() => {
            // CQ-07: reCAPTCHA failure — resolve null, backend handles missing token
            resolve(null);
          });
      });
    });
  }

  /**
   * Lazily load the reCAPTCHA v3 script.
   */
  private loadScript(): Promise<void> {
    if (this.scriptLoaded) {
      return Promise.resolve();
    }

    if (this.scriptLoading) {
      return this.scriptLoading;
    }

    this.scriptLoading = new Promise<void>((resolve, reject) => {
      if (!isPlatformBrowser(this.platformId)) {
        resolve();
        return;
      }

      // Check if script already exists
      if (document.querySelector('script[src*="recaptcha"]')) {
        this.scriptLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${this.siteKey}`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        this.scriptLoaded = true;
        resolve();
      };

      script.onerror = () => {
        // CQ-07: Script load failure — resolve silently
        resolve();
      };

      document.head.appendChild(script);
    });

    return this.scriptLoading;
  }
}
