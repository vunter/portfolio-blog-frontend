import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
} from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { LANG_STORAGE_KEY, ACCEPT_LANGUAGE_MAP } from '../services/locale.constants';

/**
 * Token Interceptor - Adds withCredentials to API requests so HttpOnly cookies are sent.
 * Reads language from locale.constants (Q6.5: no I18nService dependency).
 */
export const tokenInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const platformId = inject(PLATFORM_ID);
  if (req.url.startsWith(environment.apiUrl)) {
    const lang = isPlatformBrowser(platformId)
      ? localStorage.getItem(LANG_STORAGE_KEY) || 'en'
      : 'en';
    const acceptLanguage = ACCEPT_LANGUAGE_MAP[lang] || ACCEPT_LANGUAGE_MAP['en'];
    const clonedReq = req.clone({
      withCredentials: true,
      setHeaders: {
        'Accept-Language': acceptLanguage,
      },
    });
    return next(clonedReq);
  }

  return next(req);
};
