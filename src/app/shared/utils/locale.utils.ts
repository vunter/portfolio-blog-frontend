/**
 * M-03: Shared locale display name utility.
 * Previously duplicated in ResumeProfileComponent and HomeCustomizationComponent.
 */

const LOCALE_DISPLAY_NAMES: Record<string, string> = {
  'en': 'EN', 'pt-br': 'PT-BR', 'pt-pt': 'PT-PT',
  'es': 'ES', 'fr': 'FR', 'de': 'DE', 'it': 'IT',
  'nl': 'NL', 'pl': 'PL', 'ru': 'RU', 'ja': 'JA', 'zh': 'ZH',
};

/** Returns a display-friendly locale name, e.g. 'EN' */
export function getLocaleName(code: string): string {
  return LOCALE_DISPLAY_NAMES[code.toLowerCase()] || code.toUpperCase();
}
