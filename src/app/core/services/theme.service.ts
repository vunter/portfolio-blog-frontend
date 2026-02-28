import { Injectable, signal, computed, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CookieConsentService } from './cookie-consent.service';

export type Theme = 'light' | 'dark';
export type ThemePreference = 'light' | 'dark' | 'auto';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly STORAGE_KEY = 'app-theme';
  private readonly platformId = inject(PLATFORM_ID);
  private readonly consent = inject(CookieConsentService);
  private mediaQuery: MediaQueryList | null = null;
  private mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

  readonly preference = signal<ThemePreference>(this.getStoredPreference());
  readonly theme = signal<Theme>(this.resolveTheme(this.getStoredPreference()));
  readonly isDark = computed(() => this.theme() === 'dark');
  readonly isAuto = computed(() => this.preference() === 'auto');

  constructor() {
    if (isPlatformBrowser(this.platformId) && window.matchMedia) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaListener = (e: MediaQueryListEvent) => {
        if (this.preference() === 'auto') {
          this.theme.set(e.matches ? 'dark' : 'light');
        }
      };
      this.mediaQuery.addEventListener('change', this.mediaListener);
    }

    effect(() => {
      const currentTheme = this.theme();
      this.applyTheme(currentTheme);
    });

    effect(() => {
      const pref = this.preference();
      if (isPlatformBrowser(this.platformId) && this.consent.hasConsent('functional')) {
        localStorage.setItem(this.STORAGE_KEY, pref);
      }
      this.theme.set(this.resolveTheme(pref));
    });
  }

  private getStoredPreference(): ThemePreference {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem(this.STORAGE_KEY) as ThemePreference | null;
      if (stored === 'light' || stored === 'dark' || stored === 'auto') {
        return stored;
      }
    }
    return 'auto';
  }

  private resolveTheme(pref: ThemePreference): Theme {
    if (pref === 'light' || pref === 'dark') return pref;
    // Auto — follow system
    if (isPlatformBrowser(this.platformId) && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }

  private applyTheme(theme: Theme): void {
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.setAttribute('data-theme', theme);
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(`theme-${theme}`);
    }
  }

  toggleTheme(): void {
    // Cycle: auto → light → dark → auto
    this.preference.update((current) => {
      switch (current) {
        case 'auto': return 'light';
        case 'light': return 'dark';
        case 'dark': return 'auto';
      }
    });
  }

  setTheme(theme: Theme): void {
    this.preference.set(theme);
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
  }
}
