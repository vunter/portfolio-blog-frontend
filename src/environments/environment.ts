// INF-05: reCAPTCHA site keys should use separate keys for dev vs prod.
// In CI/CD, these values can be replaced at build time via Angular's fileReplacements
// or via a build-time environment variable injection script (e.g., envsubst).
// The dev key below is safe to commit (public site key, localhost-only domain restriction).
export const environment = {
  production: false,
  apiUrl: '/api',
  apiVersion: 'v1',
  ownerAlias: 'leonardo-catananti',
  siteUrl: 'https://catananti.dev',
  // INC-12/SEC-06: reCAPTCHA v3 — dev site key (localhost-only, safe to commit as public)
  // For build-time injection: replace with process.env.NG_APP_RECAPTCHA_SITE_KEY
  recaptchaSiteKey: '6LcCNGgsAAAAADA_ubUZ2dj68W7Lin6h0RbPSqJi',
  // BUG-RT2: Allow disabling reCAPTCHA in dev to match backend RECAPTCHA_ENABLED=false
  recaptchaEnabled: false,
  // Q8.11: Configurable scroll depth tracking thresholds (percentage points)
  scrollDepthThresholds: [25, 50, 75, 100] as readonly number[],
} as const;
