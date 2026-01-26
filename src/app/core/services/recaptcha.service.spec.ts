import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { RecaptchaService } from './recaptcha.service';
import { environment } from '../../../environments/environment';

describe('RecaptchaService', () => {
  let service: RecaptchaService;
  let originalRecaptcha: any;
  let originalSiteKey: string;
  let originalRecaptchaEnabled: any;

  function createService(platformId: string = 'browser', siteKey: string = 'test-site-key') {
    // Patch environment for test
    (environment as any).recaptchaSiteKey = siteKey;
    (environment as any).recaptchaEnabled = siteKey ? true : false;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        RecaptchaService,
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    });

    service = TestBed.inject(RecaptchaService);
  }

  beforeEach(() => {
    originalRecaptcha = (window as any)['grecaptcha'];
    originalSiteKey = environment.recaptchaSiteKey;
    originalRecaptchaEnabled = (environment as any).recaptchaEnabled;
  });

  afterEach(() => {
    (window as any)['grecaptcha'] = originalRecaptcha;
    (environment as any).recaptchaSiteKey = originalSiteKey;
    (environment as any).recaptchaEnabled = originalRecaptchaEnabled;

    // Clean up any injected script tags
    document.querySelectorAll('script[src*="recaptcha"]').forEach((s) => s.remove());
  });

  it('should be created', () => {
    createService();
    expect(service).toBeTruthy();
  });

  describe('isEnabled', () => {
    it('should return true when site key is configured', () => {
      createService('browser', 'my-key');
      expect(service.isEnabled).toBeTrue();
    });

    it('should return false when site key is empty', () => {
      createService('browser', '');
      expect(service.isEnabled).toBeFalse();
    });
  });

  describe('execute', () => {
    it('should return null on server platform', async () => {
      createService('server', 'test-key');

      const token = await service.execute('submit');
      expect(token).toBeNull();
    });

    it('should return null when reCAPTCHA is not enabled', async () => {
      createService('browser', '');

      const token = await service.execute('submit');
      expect(token).toBeNull();
    });

    it('should return token when grecaptcha is available', async () => {
      createService('browser', 'test-site-key');

      // Mock grecaptcha on window
      (window as any)['grecaptcha'] = {
        ready: (cb: () => void) => cb(),
        execute: (_siteKey: string, _opts: any) => Promise.resolve('mock-token-123'),
      };

      // Pre-mark script as loaded by adding a script tag
      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?render=test-site-key';
      document.head.appendChild(script);

      const token = await service.execute('contact_form');
      expect(token).toBe('mock-token-123');
    });

    it('should return null when grecaptcha.execute rejects', async () => {
      createService('browser', 'test-site-key');

      (window as any)['grecaptcha'] = {
        ready: (cb: () => void) => cb(),
        execute: () => Promise.reject(new Error('reCAPTCHA failed')),
      };

      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?render=test-site-key';
      document.head.appendChild(script);

      const token = await service.execute('submit');
      expect(token).toBeNull();
    });

    it('should return null when grecaptcha object is missing from window', async () => {
      createService('browser', 'test-site-key');

      delete (window as any)['grecaptcha'];

      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?render=test-site-key';
      document.head.appendChild(script);

      const token = await service.execute('login');
      expect(token).toBeNull();
    });
  });

  describe('loadScript', () => {
    it('should skip loading if script already exists in DOM', async () => {
      createService('browser', 'test-site-key');

      // Pre-add script tag
      const existingScript = document.createElement('script');
      existingScript.src = 'https://www.google.com/recaptcha/api.js?render=test-site-key';
      document.head.appendChild(existingScript);

      (window as any)['grecaptcha'] = {
        ready: (cb: () => void) => cb(),
        execute: () => Promise.resolve('cached-token'),
      };

      const token = await service.execute('action');
      expect(token).toBe('cached-token');

      // Should not have added another script tag
      const scripts = document.querySelectorAll('script[src*="recaptcha"]');
      expect(scripts.length).toBe(1);
    });

    it('should not load script on server platform', async () => {
      // Clean stale scripts from prior tests to ensure DOM isolation
      document.querySelectorAll('script[src*="recaptcha"]').forEach((s) => s.remove());

      createService('server', 'test-site-key');

      const token = await service.execute('action');
      expect(token).toBeNull();

      const scripts = document.querySelectorAll('script[src*="recaptcha"]');
      // No script should be added in server context (the service returns early)
      expect(scripts.length).toBe(0);
    });
  });
});
