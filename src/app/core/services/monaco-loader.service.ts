import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// TODO F-343: Add Window type augmentation for monaco and require

@Injectable({ providedIn: 'root' })
export class MonacoLoaderService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly MONACO_VERSION = '0.52.2';
  private loaded = signal(false);
  private loadPromise: Promise<void> | null = null;

  readonly isLoaded = this.loaded.asReadonly();

  load(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve();
    }

    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise<void>((resolve, reject) => {
      if (typeof (window as any).monaco !== 'undefined') {
        this.loaded.set(true);
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://cdn.jsdelivr.net/npm/monaco-editor@${this.MONACO_VERSION}/min/vs/loader.js`;
      script.onload = () => {
        const require = (window as any).require;
        require.config({
          paths: { vs: `https://cdn.jsdelivr.net/npm/monaco-editor@${this.MONACO_VERSION}/min/vs` }
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
