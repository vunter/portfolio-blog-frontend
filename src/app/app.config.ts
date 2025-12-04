import {
  ApplicationConfig,
  APP_INITIALIZER,
  ErrorHandler,
  inject,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  SecurityContext,
} from '@angular/core';
import { GlobalErrorHandler } from './core/services/global-error-handler.service';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideClientHydration, withEventReplay, withHttpTransferCacheOptions, withIncrementalHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideMarkdown, SANITIZE } from 'ngx-markdown';
import { provideServiceWorker } from '@angular/service-worker';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import localeEs from '@angular/common/locales/es';
import localeIt from '@angular/common/locales/it';

import { routes } from './app.routes';
import { tokenInterceptor } from './core/interceptors/token.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { refreshTokenInterceptor } from './core/interceptors/refresh-token.interceptor';
import { AuthStore } from './core/auth/auth.store';

registerLocaleData(localePt);
registerLocaleData(localeEs);
registerLocaleData(localeIt);

function initializeAuth(): () => void {
  const authStore = inject(AuthStore);
  return () => authStore.initFromStorage();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withViewTransitions(), withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    provideHttpClient(
      withFetch(),
      withInterceptors([
        tokenInterceptor,
        refreshTokenInterceptor,
        errorInterceptor,
      ]),
      withXsrfConfiguration({
        cookieName: 'XSRF-TOKEN',
        headerName: 'X-XSRF-TOKEN',
      })
    ),
    provideAnimationsAsync(),
    provideClientHydration(withEventReplay(), withIncrementalHydration(), withHttpTransferCacheOptions({
      includePostRequests: false,
    })),
    provideMarkdown({
      sanitize: {
        provide: SANITIZE,
        useValue: SecurityContext.HTML,
      },
    }),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      multi: true,
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
