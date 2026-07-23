import { ErrorHandler, Injectable, inject, isDevMode, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Lazily-loaded Sentry module type, so the SDK never lands in the initial bundle.
type SentryModule = typeof import('@sentry/angular');

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

  // Q13.1: Sentry is loaded lazily (dynamic import) so its ~200KB stays off the
  // critical path. This resolves to the module once loaded + initialized.
  private static sentry: SentryModule | null = null;
  private static sentryLoading: Promise<SentryModule | null> | null = null;

  constructor() {
    if (
      isPlatformBrowser(this.platformId) &&
      environment.sentryEnabled &&
      environment.sentryDsn
    ) {
      // Defer the import to browser idle so it never competes with first paint.
      this.scheduleSentryLoad();
    }
  }

  private scheduleSentryLoad(): void {
    const start = () => { GlobalErrorHandler.sentryLoading ??= this.loadSentry(); };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback;
    if (typeof ric === 'function') {
      ric(start, { timeout: 5000 });
    } else {
      setTimeout(start, 3000);
    }
  }

  private async loadSentry(): Promise<SentryModule | null> {
    try {
      const Sentry = await import('@sentry/angular');
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
      GlobalErrorHandler.sentry = Sentry;
      return Sentry;
    } catch {
      // Sentry is optional — a load/init failure must never break error handling.
      return null;
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

    // Q13.1: Report to Sentry (lazily loaded). If it hasn't finished loading yet,
    // capture once it resolves so early errors aren't dropped.
    if (
      isPlatformBrowser(this.platformId) &&
      environment.sentryEnabled &&
      environment.sentryDsn &&
      error instanceof Error
    ) {
      if (GlobalErrorHandler.sentry) {
        GlobalErrorHandler.sentry.captureException(error);
      } else {
        GlobalErrorHandler.sentryLoading ??= this.loadSentry();
        GlobalErrorHandler.sentryLoading.then((s) => s?.captureException(error));
      }
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
