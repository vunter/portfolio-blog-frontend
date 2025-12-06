import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * MED-09: Shared download service that abstracts the document.createElement('a')
 * download trigger pattern with proper SSR safety checks.
 *
 * Replaces repeated inline download logic across multiple components.
 */
@Injectable({ providedIn: 'root' })
export class DownloadService {
  private readonly platformId = inject(PLATFORM_ID);

  /**
   * Trigger a file download from a Blob.
   * Creates a temporary object URL, triggers download via an anchor click,
   * and revokes the URL after a short delay.
   */
  downloadBlob(blob: Blob, filename: string): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const url = URL.createObjectURL(blob);
    this.triggerDownload(url, filename);
    // Delay revoke to allow download to start
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Trigger a file download from a data URI or regular URL.
   */
  downloadUrl(url: string, filename: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.triggerDownload(url, filename);
  }

  /**
   * Trigger a file download from a text string (e.g., CSV content).
   */
  downloadText(content: string, filename: string, mimeType = 'text/plain'): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const blob = new Blob([content], { type: mimeType });
    this.downloadBlob(blob, filename);
  }

  private triggerDownload(url: string, filename: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
