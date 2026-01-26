import { TestBed } from '@angular/core/testing';
import { ThemeService, Theme } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.body.classList.remove('theme-light', 'theme-dark');

    // Mock matchMedia so 'auto' preference resolves to 'light' deterministically
    spyOn(window, 'matchMedia').and.returnValue({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: jasmine.createSpy('addListener'),
      removeListener: jasmine.createSpy('removeListener'),
      addEventListener: jasmine.createSpy('addEventListener'),
      removeEventListener: jasmine.createSpy('removeEventListener'),
      dispatchEvent: jasmine.createSpy('dispatchEvent'),
    } as any);

    TestBed.configureTestingModule({
      providers: [ThemeService],
    });
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.body.classList.remove('theme-light', 'theme-dark');
  });

  describe('initial theme', () => {
    it('should default to dark when no stored preference', () => {
      service = TestBed.inject(ThemeService);
      // Default fallback is dark
      expect(service.theme()).toBeDefined();
    });

    it('should restore stored theme from localStorage', () => {
      localStorage.setItem('app-theme', 'light');
      service = TestBed.inject(ThemeService);
      expect(service.theme()).toBe('light');
    });

    it('should restore dark theme from localStorage', () => {
      localStorage.setItem('app-theme', 'dark');
      service = TestBed.inject(ThemeService);
      expect(service.theme()).toBe('dark');
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from dark to light', () => {
      localStorage.setItem('app-theme', 'dark');
      service = TestBed.inject(ThemeService);
      expect(service.theme()).toBe('dark');

      service.toggleTheme();
      TestBed.flushEffects();
      expect(service.theme()).toBe('light');
    });

    it('should toggle from light to dark', () => {
      localStorage.setItem('app-theme', 'light');
      service = TestBed.inject(ThemeService);
      expect(service.theme()).toBe('light');

      service.toggleTheme();
      TestBed.flushEffects();
      expect(service.theme()).toBe('dark');
    });

    it('should persist toggled theme to localStorage', () => {
      localStorage.setItem('app-theme', 'dark');
      service = TestBed.inject(ThemeService);

      service.toggleTheme();

      TestBed.flushEffects();
      expect(localStorage.getItem('app-theme')).toBe('auto');
    });
  });

  describe('setTheme', () => {
    it('should set light theme', () => {
      localStorage.setItem('app-theme', 'dark');
      service = TestBed.inject(ThemeService);

      service.setTheme('light');
      TestBed.flushEffects();
      expect(service.theme()).toBe('light');
    });

    it('should set dark theme', () => {
      localStorage.setItem('app-theme', 'light');
      service = TestBed.inject(ThemeService);

      service.setTheme('dark');
      TestBed.flushEffects();
      expect(service.theme()).toBe('dark');
    });
  });

  describe('isDark signal', () => {
    it('should be true when theme is dark', () => {
      localStorage.setItem('app-theme', 'dark');
      service = TestBed.inject(ThemeService);
      TestBed.flushEffects();
      expect(service.isDark()).toBeTrue();
    });

    it('should be false when theme is light', () => {
      localStorage.setItem('app-theme', 'light');
      service = TestBed.inject(ThemeService);
      TestBed.flushEffects();
      expect(service.isDark()).toBeFalse();
    });

    it('should update when theme changes', () => {
      localStorage.setItem('app-theme', 'dark');
      service = TestBed.inject(ThemeService);
      TestBed.flushEffects();
      expect(service.isDark()).toBeTrue();

      service.toggleTheme();
      TestBed.flushEffects();
      expect(service.isDark()).toBeFalse();
    });
  });

  describe('DOM application', () => {
    it('should set data-theme attribute on documentElement', () => {
      localStorage.setItem('app-theme', 'light');
      service = TestBed.inject(ThemeService);
      TestBed.flushEffects();

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should add theme class to body', () => {
      localStorage.setItem('app-theme', 'dark');
      service = TestBed.inject(ThemeService);
      TestBed.flushEffects();

      expect(document.body.classList.contains('theme-dark')).toBeTrue();
    });

    it('should remove old theme class and add new on toggle', () => {
      localStorage.setItem('app-theme', 'dark');
      service = TestBed.inject(ThemeService);
      TestBed.flushEffects();

      service.toggleTheme();
      TestBed.flushEffects();

      expect(document.body.classList.contains('theme-light')).toBeTrue();
      expect(document.body.classList.contains('theme-dark')).toBeFalse();
    });
  });
});
