export const environment = {
  production: false,
  apiUrl: '/api',
  apiVersion: 'v1',
  ownerAlias: 'leonardo-catananti',
  siteUrl: 'https://catananti.dev',
  // INC-12/SEC-06: reCAPTCHA v3 — same key works for localhost if registered
  // TODO F-365: Use separate reCAPTCHA site key for development
  recaptchaSiteKey: '6LcCNGgsAAAAADA_ubUZ2dj68W7Lin6h0RbPSqJi',
  // BUG-RT2: Allow disabling reCAPTCHA in dev to match backend RECAPTCHA_ENABLED=false
  recaptchaEnabled: false,
} as const;
