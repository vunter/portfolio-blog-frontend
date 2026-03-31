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
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
// provideClientHydration re-enabled — progress interceptor now skips on server
// to avoid TransferCacheInterceptorFn conflict (see progress.interceptor.ts)
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideMarkdown } from 'ngx-markdown';
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

registerLocaleData(localePt);
registerLocaleData(localeEs);
registerLocaleData(localeIt);

function initializeAuth(): () => Promise<void> {
  const authStore = inject(AuthStore);
  return () => authStore.initFromStorage();
}

function initializeBookmarks(): () => void {
  const bookmarkService = inject(BookmarkService);
  return () => bookmarkService.init();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withViewTransitions(), withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
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
    provideClientHydration(withHttpTransferCacheOptions({
      includePostRequests: false,
    })),
    provideMarkdown(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
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
