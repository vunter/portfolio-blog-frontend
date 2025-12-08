const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  pt: 'pt-BR',
  es: 'es-ES',
  it: 'it-IT',
};

export function getDateLocale(lang: string): string {
  return LOCALE_MAP[lang] ?? 'en-US';
}

export function formatDate(date: string | Date, lang: string): string {
  return new Date(date).toLocaleDateString(getDateLocale(lang), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
