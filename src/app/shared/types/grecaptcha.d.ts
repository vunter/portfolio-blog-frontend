interface GRecaptchaEnterprise {
  ready(callback: () => void): void;
  execute(siteKey: string, options: { action: string }): Promise<string>;
}

interface Window {
  grecaptcha: {
    enterprise: GRecaptchaEnterprise;
  };
}
