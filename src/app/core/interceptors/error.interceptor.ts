import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { I18nService } from '../services/i18n.service';

/**
 * Error Interceptor - Handles HTTP errors globally with i18n support.
 * Uses lazy I18nService resolution via Injector to avoid circular dependency
 * (I18nService constructor triggers HTTP requests that pass through this interceptor).
 */
export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const notification = inject(NotificationService);
  const router = inject(Router);
  const injector = inject(Injector);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Lazily resolve I18nService — safe here because catchError runs async,
      // after I18nService construction has completed
      let i18n: I18nService | null = null;
      try { i18n = injector.get(I18nService); } catch { /* fallback below */ }

      const t = (key: string) => i18n?.t(key) ?? key;
      let errorMessage = t('error.unexpected');

      switch (error.status) {
        case 0:
          errorMessage = t('error.connectionFailed');
          break;
        case 400:
          errorMessage = t('error.badRequest');
          break;
        case 401:
          // Handled by refresh token interceptor
          return throwError(() => error);
        case 403:
          errorMessage = t('error.forbidden');
          break;
        case 404:
          errorMessage = t('error.notFound');
          break;
        case 409:
          errorMessage = t('error.conflict');
          break;
        case 422:
          errorMessage = t('error.invalidData');
          break;
        case 429:
          errorMessage = t('error.tooManyRequests');
          break;
        case 500:
          errorMessage = t('error.serverError');
          break;
        case 502:
        case 503:
        case 504:
          errorMessage = t('error.serviceUnavailable');
          break;
      }

      // Don't show notification for some endpoints
      const silentEndpoints = ['/auth/login', '/auth/refresh'];
      const isSilent = silentEndpoints.some((endpoint) =>
        req.url.includes(endpoint)
      );

      // Silence 400s with validationErrors — components handle field-level display
      const hasValidationErrors = error.status === 400 && error.error?.validationErrors &&
        Object.keys(error.error.validationErrors).length > 0;

      if (!isSilent && error.status !== 401 && !hasValidationErrors) {
        notification.error(errorMessage);
      }

      return throwError(() => error);
    })
  );
};
