import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { I18nService } from '../services/i18n.service';

/**
 * Token Interceptor - Adds withCredentials to API requests so HttpOnly cookies are sent
 * Also sends Accept-Language header based on current language selection
 */
export const tokenInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  // Add withCredentials for all API requests to our backend
  if (req.url.startsWith(environment.apiUrl)) {
    const i18nService = inject(I18nService);
    const lang = i18nService.language();
      // INT-01: Map all supported locales to proper Accept-Language headers
      const langMap: Record<string, string> = {
        pt: 'pt-BR,pt;q=0.9,en;q=0.5',
        es: 'es;q=1,en;q=0.5',
        it: 'it;q=1,en;q=0.5',
        en: 'en,pt-BR;q=0.5',
      };
      const acceptLanguage = langMap[lang] || 'en,pt-BR;q=0.5';
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
