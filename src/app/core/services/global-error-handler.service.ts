import { ErrorHandler, Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly platformId = inject(PLATFORM_ID);

  handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack ?? '' : '';

    console.error('[GlobalErrorHandler]', message, stack);

    // Reload on chunk loading errors (lazy route failures) — browser only, with guard against infinite loops
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
  }
}
