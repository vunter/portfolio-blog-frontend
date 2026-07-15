/**
 * Returns a scroll behavior that respects the user's reduced-motion preference.
 * CSS `scroll-behavior` is neutralized by the global reduced-motion rule, but an
 * explicit `behavior: 'smooth'` passed to scrollTo/scrollIntoView from JS is not —
 * so vestibular-sensitive users would still get animated scrolling. Use this helper
 * at every programmatic scroll call site.
 */
export function scrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'auto';
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}
