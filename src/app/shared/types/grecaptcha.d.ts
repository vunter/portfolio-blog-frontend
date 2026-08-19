// AUD18-A2: Standard reCAPTCHA v3 (api.js?render=...) exposes ready/execute directly
// on window.grecaptcha. The previous typing modeled the Enterprise namespace
// (grecaptcha.enterprise), which the standard script never defines.
interface GRecaptcha {
  ready(callback: () => void): void;
  execute(siteKey: string, options: { action: string }): Promise<string>;
}

interface Window {
  grecaptcha?: GRecaptcha;
}
