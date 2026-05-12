import { ErrorHandler, Injectable, inject, isDevMode, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpBackend } from '@angular/common/http';
import * as Sentry from '@sentry/angular';
import { environment } from '../../../environments/environment';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly platformId = inject(PLATFORM_ID);
  // Q13.3: Bypass interceptors to avoid circular dependency & error loops
  private readonly http = new HttpClient(inject(HttpBackend));

  // Q13.3: Rate-limit error reports — max 5 per minute
  private reportCount = 0;
  private reportWindowStart = 0;
  private static readonly MAX_REPORTS_PER_MINUTE = 5;
  private readonly reportedErrors = new Set<string>();

  // Q13.1: Sentry initialization flag
  private static sentryInitialized = false;

  constructor() {
    if (
      isPlatformBrowser(inject(PLATFORM_ID)) &&
      environment.sentryEnabled &&
      environment.sentryDsn &&
      !GlobalErrorHandler.sentryInitialized
    ) {
      Sentry.init({
        dsn: environment.sentryDsn,
        environment: environment.production ? 'production' : 'development',
        tracesSampleRate: environment.production ? 0.2 : 1.0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: environment.production ? 1.0 : 0,
        integrations: [
          Sentry.browserTracingIntegration(),
        ],
      });
      GlobalErrorHandler.sentryInitialized = true;
    }
  }

  handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack ?? '' : '';

    if (isDevMode()) {
      console.error('[GlobalErrorHandler]', message, stack);
    }

    // Reload on chunk loading errors (lazy route failures) — browser only
    if (
      isPlatformBrowser(this.platformId) &&
      (message.includes('ChunkLoadError') || message.includes('Loading chunk'))
    ) {
      const lastReload = sessionStorage.getItem('chunk-reload-ts');
      const now = Date.now();
      if (!lastReload || (now - parseInt(lastReload, 10)) > 30000) {
        sessionStorage.setItem('chunk-reload-ts', now.toString());
        window.location.reload();
      }
      return;
    }

    // Q13.1: Report to Sentry if initialized
    if (GlobalErrorHandler.sentryInitialized && error instanceof Error) {
      Sentry.captureException(error);
    }

    // Q13.3: Also report to custom backend endpoint (production only)
    if (!isDevMode() && isPlatformBrowser(this.platformId)) {
      this.reportToBackend(message, stack);
    }
  }

  private reportToBackend(message: string, stack: string): void {
    const fingerprint = message.substring(0, 200);
    if (this.reportedErrors.has(fingerprint)) return;

    const now = Date.now();
    if (now - this.reportWindowStart > 60_000) {
      this.reportCount = 0;
      this.reportWindowStart = now;
    }
    if (this.reportCount >= GlobalErrorHandler.MAX_REPORTS_PER_MINUTE) return;
    this.reportCount++;
    this.reportedErrors.add(fingerprint);

    this.http.post('/api/v1/client-errors', {
      message: message.substring(0, 2000),
      url: window.location.href.substring(0, 500),
      source: 'angular-global-error-handler',
      stack: stack.substring(0, 10000),
      userAgent: navigator.userAgent.substring(0, 500),
    }).subscribe({ error: () => { /* silently fail — don't cause error loop */ } });
  }
}
