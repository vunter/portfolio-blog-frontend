/**
 * Q6.5: Extracted from i18n.service.ts to break circular dependency.
 * Interceptors import from here instead of from I18nService module,
 * avoiding any transitive dependency on HttpClient.
 */
export const LANG_STORAGE_KEY = 'app-language';

export const ACCEPT_LANGUAGE_MAP: Record<string, string> = {
  pt: 'pt-BR,pt;q=0.9,en;q=0.5',
  es: 'es;q=1,en;q=0.5',
  it: 'it;q=1,en;q=0.5',
  en: 'en,pt-BR;q=0.5',
};
