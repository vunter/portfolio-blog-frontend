import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

declare global {
  interface Window {
    monaco?: any;
    require?: any;
  }
}

@Injectable({ providedIn: 'root' })
export class MonacoLoaderService {
  private readonly platformId = inject(PLATFORM_ID);
  private loaded = signal(false);
  private loadPromise: Promise<void> | null = null;

  readonly isLoaded = this.loaded.asReadonly();

  load(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve();
    }

    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise<void>((resolve, reject) => {
      if (typeof (window as Window).monaco !== 'undefined') {
        this.loaded.set(true);
        resolve();
        return;
      }

      // SEC-F-05: Load Monaco from local assets instead of CDN to avoid third-party
      // script injection risks and eliminate the need for SRI on a CDN resource.
      // Assets are copied from node_modules/monaco-editor via angular.json asset config.
      const script = document.createElement('script');
      script.src = '/assets/monaco-editor/min/vs/loader.js';
      script.onload = () => {
        const require = (window as Window).require!;
        require.config({
          paths: { vs: '/assets/monaco-editor/min/vs' }
        });
        require(['vs/editor/editor.main'], () => {
          this.loaded.set(true);
          resolve();
        });
      };
      script.onerror = () => reject(new Error('Failed to load Monaco editor'));
      document.head.appendChild(script);
    });

    return this.loadPromise;
  }
}
