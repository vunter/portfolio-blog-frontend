import { ErrorHandler, Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly platformId = inject(PLATFORM_ID);

  handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack ?? '' : '';

    console.error('[GlobalErrorHandler]', message, stack);

    // Reload on chunk loading errors (lazy route failures) — browser only
    if (
      isPlatformBrowser(this.platformId) &&
      (message.includes('ChunkLoadError') || message.includes('Loading chunk'))
    ) {
      window.location.reload();
      return;
    }
  }
}
