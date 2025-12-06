import { Injectable, signal, effect, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { en } from './i18n/en';

export type Language = 'en' | 'pt' | 'es' | 'it';

type Translations = Record<string, string>;

/**
 * Lazy-loaded i18n service.
 * English is bundled inline (default); other locales are loaded on demand
 * via dynamic import(), reducing initial bundle by ~50%.
 *
 * M-01: Uses platform checks instead of direct localStorage access
 * for SSR safety (StorageService uses JSON.parse which would mangle plain strings).
 */
@Injectable({
  providedIn: 'root',
})
export class I18nService {
  private readonly STORAGE_KEY = 'app-language';
  private readonly cache = new Map<Language, Translations>([['en', en]]);
  private readonly loadedTranslations = signal<Translations>(en);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly language = signal<Language>(this.getInitialLanguage());
  readonly isEnglish = computed(() => this.language() === 'en');

  constructor() {
    // Persist language preference and load translations
    // M-01: Use isBrowser check instead of raw typeof localStorage
    effect(() => {
      const currentLang = this.language();
      if (this.isBrowser) {
        localStorage.setItem(this.STORAGE_KEY, currentLang);
      }
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('lang', currentLang);
      }
      this.loadTranslations(currentLang);
    });
  }

  private getInitialLanguage(): Language {
    // M-01: Use isBrowser property for SSR safety
    if (!this.isBrowser) return 'en';
    const stored = localStorage.getItem(this.STORAGE_KEY) as Language | null;
    const supported: Language[] = ['en', 'pt', 'es', 'it'];
    if (stored && supported.includes(stored)) {
      return stored;
    }
    // BUG-07: Always default to 'en' when no explicit preference is stored.
    // Browser locale detection caused unexpected language changes for users
    // who never explicitly chose a language.
    return 'en';
  }

  private loadTranslations(lang: Language): void {
    if (this.cache.has(lang)) {
      this.loadedTranslations.set(this.cache.get(lang)!);
      return;
    }

    // Dynamic import creates a separate chunk per locale
    const loader = this.getLoader(lang);
    if (loader) {
      loader.then((mod) => {
        const translations = mod[lang] as Translations;
        this.cache.set(lang, translations);
        this.loadedTranslations.set(translations);
      });
    }
  }

  private getLoader(lang: Language): Promise<Record<string, Translations>> | null {
    switch (lang) {
      case 'pt': return import('./i18n/pt');
      case 'es': return import('./i18n/es');
      case 'it': return import('./i18n/it');
      default: return null;
    }
  }

  t(key: string, params?: Record<string, string>): string {
    const current = this.loadedTranslations();
    let text = current[key] || en[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
      });
    }
    return text;
  }

  toggleLanguage(): void {
    const langs: Language[] = ['en', 'pt', 'es', 'it'];
    const idx = langs.indexOf(this.language());
    this.language.set(langs[(idx + 1) % langs.length]);
  }

  setLanguage(lang: Language): void {
    this.language.set(lang);
  }
}