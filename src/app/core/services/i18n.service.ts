import { Injectable, signal, effect, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { en } from './i18n/en';
import { CookieConsentService } from './cookie-consent.service';

export type Language = string;

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  sortOrder: number;
}

type Translations = Record<string, string>;

const DEFAULT_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', sortOrder: 0 },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', sortOrder: 1 },
  { code: 'es', name: 'Spanish', nativeName: 'Español', sortOrder: 2 },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', sortOrder: 3 },
];

const LANG_CACHE_KEY = 'supported-languages';
const LANG_CACHE_TTL = 3600_000; // 1h
const I18N_CACHE_PREFIX = 'i18n-';
const I18N_CACHE_TTL = 86400_000; // 24h

/**
 * DB-driven i18n service.
 * English is bundled inline (always available fallback).
 * Other locales fetched from GET /api/v1/i18n/{locale} — response adapts by user role.
 * Cached in localStorage with 24h TTL. Re-fetches on auth state change.
 */
@Injectable({
  providedIn: 'root',
})
export class I18nService {
  private readonly STORAGE_KEY = 'app-language';
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly consent = inject(CookieConsentService);
  private readonly http = inject(HttpClient);
  // Bypasses interceptor chain to avoid circular dependency during construction
  private readonly directHttp = new HttpClient(inject(HttpBackend));

  private readonly loadedTranslations = signal<Translations>(en);
  private currentTier = 'public';

  /** Dynamic supported languages from backend */
  readonly supportedLanguages = signal<LanguageOption[]>(DEFAULT_LANGUAGES);
  readonly supportedCodes = computed(() => this.supportedLanguages().map(l => l.code));

  readonly language = signal<Language>(this.getInitialLanguage());
  readonly isEnglish = computed(() => this.language() === 'en');
  readonly translationsLoading = signal(false);
  readonly translationsReady = signal(true);

  constructor() {
    if (this.isBrowser) {
      this.fetchSupportedLanguages();
    }

    effect(() => {
      const currentLang = this.language();
      if (this.isBrowser && this.consent.hasConsent('functional')) {
        localStorage.setItem(this.STORAGE_KEY, currentLang);
      }
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('lang', currentLang);
      }
      this.loadTranslations(currentLang);
    });
  }

  /** Call after login/logout/role change to re-fetch translations with new tier */
  refreshTranslations(tier?: string): void {
    if (tier) {
      this.currentTier = tier;
    }
    const lang = this.language();
    if (lang !== 'en') {
      // Clear cached translations for this locale to force re-fetch
      this.clearI18nCache(lang);
      this.loadTranslations(lang);
    }
  }

  /** Set current auth tier for caching */
  setAuthTier(tier: string): void {
    if (tier !== this.currentTier) {
      this.currentTier = tier;
      this.refreshTranslations();
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
    const codes = this.supportedCodes();
    const idx = codes.indexOf(this.language());
    this.language.set(codes[(idx + 1) % codes.length]);
  }

  setLanguage(lang: Language): void {
    this.language.set(lang);
  }

  fetchSupportedLanguages(): void {
    // Check localStorage cache
    const cached = this.getCachedJson<{ data: LanguageOption[]; ts: number }>(LANG_CACHE_KEY);
    if (cached && Date.now() - cached.ts < LANG_CACHE_TTL) {
      this.supportedLanguages.set(cached.data);
    }

    this.directHttp.get<LanguageOption[]>('/api/v1/languages').subscribe({
      next: (langs) => {
        if (langs?.length) {
          this.supportedLanguages.set(langs);
          this.setCachedJson(LANG_CACHE_KEY, { data: langs, ts: Date.now() });
        }
      },
      error: () => { /* keep defaults/cached */ },
    });
  }

  private getInitialLanguage(): Language {
    if (!this.isBrowser) return 'en';
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) return stored;
    return this.detectBrowserLanguage();
  }

  private detectBrowserLanguage(): Language {
    const supported = this.supportedCodes();
    const browserLangs = navigator.languages ?? [navigator.language];
    for (const lang of browserLangs) {
      const short = lang.split('-')[0].toLowerCase();
      if (supported.includes(short)) return short;
    }
    return 'en';
  }

  private loadTranslations(lang: Language): void {
    if (lang === 'en') {
      this.loadedTranslations.set(en);
      this.translationsReady.set(true);
      this.translationsLoading.set(false);
      return;
    }

    // Check localStorage cache
    const cacheKey = `${I18N_CACHE_PREFIX}${lang}-${this.currentTier}`;
    const cached = this.getCachedJson<{ data: Translations; ts: number }>(cacheKey);
    if (cached && Date.now() - cached.ts < I18N_CACHE_TTL) {
      // Merge with en fallback
      this.loadedTranslations.set({ ...en, ...cached.data });
      this.translationsReady.set(true);
      this.translationsLoading.set(false);
      // Background refresh
      this.fetchFromApi(lang, cacheKey, true);
      return;
    }

    // No cache — show loading state
    this.translationsLoading.set(true);
    this.translationsReady.set(false);
    this.fetchFromApi(lang, cacheKey, false);
  }

  private fetchFromApi(lang: string, cacheKey: string, isBackground: boolean): void {
    this.http.get<Translations>(`/api/v1/i18n/${lang}`).subscribe({
      next: (translations) => {
        if (translations && Object.keys(translations).length > 0) {
          this.setCachedJson(cacheKey, { data: translations, ts: Date.now() });
          this.loadedTranslations.set({ ...en, ...translations });
        }
        this.translationsReady.set(true);
        this.translationsLoading.set(false);
      },
      error: () => {
        // Fallback to English if API is down
        if (!isBackground) {
          this.loadedTranslations.set(en);
          this.translationsReady.set(true);
          this.translationsLoading.set(false);
        }
      },
    });
  }

  private clearI18nCache(lang: string): void {
    if (!this.isBrowser) return;
    // Remove all cached tiers for this locale
    for (const tier of ['public', 'viewer', 'dev', 'admin']) {
      try { localStorage.removeItem(`${I18N_CACHE_PREFIX}${lang}-${tier}`); } catch {}
    }
  }

  private getCachedJson<T>(key: string): T | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private setCachedJson(key: string, value: unknown): void {
    if (!this.isBrowser) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
}