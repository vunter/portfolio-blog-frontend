import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
} from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

const LANG_STORAGE_KEY = 'app-language';

const LANG_MAP: Record<string, string> = {
  pt: 'pt-BR,pt;q=0.9,en;q=0.5',
  es: 'es;q=1,en;q=0.5',
  it: 'it;q=1,en;q=0.5',
  en: 'en,pt-BR;q=0.5',
};

/**
 * Token Interceptor - Adds withCredentials to API requests so HttpOnly cookies are sent.
 * Reads language from localStorage directly to avoid circular dependency with I18nService
 * (I18nService constructor triggers HTTP requests that pass through this interceptor).
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
    const acceptLanguage = LANG_MAP[lang] || LANG_MAP['en'];
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
