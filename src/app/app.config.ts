import {
  ApplicationConfig,
  APP_INITIALIZER,
  ErrorHandler,
  inject,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { GlobalErrorHandler } from './core/services/global-error-handler.service';
import { provideRouter, withInMemoryScrolling, withPreloading, withViewTransitions } from '@angular/router';
// provideClientHydration re-enabled — progress interceptor now skips on server
// to avoid TransferCacheInterceptorFn conflict (see progress.interceptor.ts)
import { provideClientHydration, withEventReplay, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import localeEs from '@angular/common/locales/es';
import localeIt from '@angular/common/locales/it';

import { routes } from './app.routes';
import { tokenInterceptor } from './core/interceptors/token.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { refreshTokenInterceptor } from './core/interceptors/refresh-token.interceptor';
import { progressInterceptor } from './core/interceptors/progress.interceptor';
import { AuthStore } from './core/auth/auth.store';
import { BookmarkService } from './core/services/bookmark.service';
import { SelectivePreloadStrategy } from './core/strategies/selective-preload.strategy';

registerLocaleData(localePt);
registerLocaleData(localeEs);
registerLocaleData(localeIt);

function initializeAuth(): () => Promise<void> {
  const authStore = inject(AuthStore);
  return () => {
    // Subscribe before initFromStorage so any storage event arriving
    // between bootstrap and the first auth-resolved tick is observed.
    authStore.subscribeToCrossTabAuthChanges();
    return authStore.initFromStorage();
  };
}

function initializeBookmarks(): () => void {
  const bookmarkService = inject(BookmarkService);
  return () => bookmarkService.init();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withViewTransitions(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      // PERF-2: Opt-in preloading. Only routes flagged with data:{preload:true}
      // are preloaded after the first navigation — guarded admin/resume/auth
      // chunks are no longer downloaded for anonymous visitors.
      withPreloading(SelectivePreloadStrategy),
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([
        progressInterceptor,
        tokenInterceptor,
        refreshTokenInterceptor,
        errorInterceptor,
      ]),
      // SEC-F-07: XSRF protection — Angular reads the XSRF-TOKEN cookie set by the backend
      // and attaches it as X-XSRF-TOKEN header on mutation requests. The backend validates
      // the header against the cookie to prevent cross-subdomain CSRF attacks. All HTTP
      // requests go through ApiService/AuthService which use this shared HttpClient config.
      withXsrfConfiguration({
        cookieName: 'XSRF-TOKEN',
        headerName: 'X-XSRF-TOKEN',
      })
    ),
    provideAnimationsAsync(),
    provideClientHydration(
      // Replay clicks / form input / scrolls that happened between the SSR
      // paint and Angular finishing hydration. Without this, fast users on
      // slow networks tap a CTA and nothing happens.
      withEventReplay(),
      withHttpTransferCacheOptions({
        includePostRequests: false,
      }),
    ),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // Sentry is loaded lazily from GlobalErrorHandler (off the critical path), so it
    // no longer contributes to the initial bundle. The Angular-router TraceService
    // provider was removed with the static import; browserTracingIntegration still
    // instruments navigations via the History API.
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeBookmarks,
      multi: true,
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
