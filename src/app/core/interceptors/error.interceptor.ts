import { inject } from '@angular/core';
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
 * Error Interceptor - Handles HTTP errors globally with i18n support
 */
export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const notification = inject(NotificationService);
  const router = inject(Router);
  const i18n = inject(I18nService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = i18n.t('error.unexpected');

      switch (error.status) {
        case 0:
          errorMessage = i18n.t('error.connectionFailed');
          break;
        case 400:
          errorMessage = i18n.t('error.badRequest');
          break;
        case 401:
          // Handled by refresh token interceptor
          return throwError(() => error);
        case 403:
          errorMessage = i18n.t('error.forbidden');
          break;
        case 404:
          errorMessage = i18n.t('error.notFound');
          break;
        case 409:
          errorMessage = i18n.t('error.conflict');
          break;
        case 422:
          errorMessage = i18n.t('error.invalidData');
          break;
        case 429:
          errorMessage = i18n.t('error.tooManyRequests');
          break;
        case 500:
          errorMessage = i18n.t('error.serverError');
          break;
        case 502:
        case 503:
        case 504:
          errorMessage = i18n.t('error.serviceUnavailable');
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
