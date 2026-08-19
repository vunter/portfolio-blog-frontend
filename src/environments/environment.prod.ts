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
  // INC-12/SEC-06: Google reCAPTCHA v3 Site Key — public key, prod-domain restricted.
  // reCAPTCHA site keys are public by design and safe to hardcode (not a secret).
  // fe-security-contract-5: This currently reuses the same key as environment.ts.
  // A dedicated PRODUCTION reCAPTCHA key (domain-scoped to catananti.dev) should be
  // provisioned so dev/prod traffic, analytics, and domain validation stay separate.
  // This file (environment.prod.ts) IS the build-time injection point: angular.json's
  // `fileReplacements` swaps environment.ts → environment.prod.ts for production builds,
  // so the dedicated prod key belongs here once provisioned.
  recaptchaSiteKey: '6LcCNGgsAAAAADA_ubUZ2dj68W7Lin6h0RbPSqJi',
  recaptchaEnabled: true,
  // Q8.11: Configurable scroll depth tracking thresholds (percentage points)
  scrollDepthThresholds: [25, 50, 75, 100] as readonly number[],
  // AUD18-M9: Sentry is OFF. No CI/CD injection of the DSN exists today — the
  // previous "inject via CI/CD" comment described machinery that was never built,
  // leaving sentryEnabled:true with an empty DSN (a silent no-op). To enable:
  // provision a real DSN, add an actual build-time injection step (or hardcode the
  // DSN here — Sentry DSNs are not secrets), then flip sentryEnabled to true.
  sentryDsn: '',
  sentryEnabled: false,
} as const;
