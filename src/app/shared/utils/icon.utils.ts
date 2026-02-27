/**
 * Determine how to render an icon/emoji field value.
 * Shared across learning-section and proficiency-section components.
 */
export function getIconType(value: string | undefined | null): 'fa' | 'img' | 'emoji' | 'none' {
  if (!value || !value.trim()) return 'none';
  const v = value.trim();
  // Font Awesome classes: start with fa, fas, fab, far, fal, fad, fat
  if (/^fa[sbrldt]?\s+fa-/.test(v)) return 'fa';
  // Image URL
  if (/^(https?:\/\/|\/)/i.test(v) || /\.(png|jpg|jpeg|gif|svg|webp|ico)(\?.*)?$/i.test(v)) return 'img';
  // Everything else (emoji, text symbol, etc.)
  return 'emoji';
}
