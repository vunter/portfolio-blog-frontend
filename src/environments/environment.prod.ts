// INF-05: Production reCAPTCHA site key should be injected at build time via CI/CD.
// Use Angular's fileReplacements in angular.json or a build-time script to replace this file
// with a version that reads from environment variables (e.g., process.env.NG_APP_RECAPTCHA_SITE_KEY).
// The key below is a public Google reCAPTCHA v3 site key (not a secret), but prod and dev
// should use separate keys for proper domain validation and analytics separation.
export const environment = {
  production: true,
  apiUrl: '/api',
  apiVersion: 'v1',
  ownerAlias: 'leonardo-catananti',
  siteUrl: 'https://catananti.dev',
  // INC-12/SEC-06: Google reCAPTCHA v3 Site Key — public key, prod-domain restricted
  // Build-time injection (NG_APP_RECAPTCHA_SITE_KEY) is recommended but not required:
  // reCAPTCHA site keys are public by design and safe to hardcode.
  recaptchaSiteKey: '6LcCNGgsAAAAADA_ubUZ2dj68W7Lin6h0RbPSqJi',
  recaptchaEnabled: true,
} as const;
