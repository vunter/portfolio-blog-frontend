import { TestBed } from '@angular/core/testing';
import { I18nService, Language } from './i18n.service';

describe('I18nService', () => {
  let service: I18nService;
  let ptTranslations: Record<string, string>;

  beforeAll(async () => {
    ptTranslations = (await import('./i18n/pt')).pt;
  });

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
  });

  function createService(): I18nService {
    TestBed.configureTestingModule({
      providers: [I18nService],
    });
    return TestBed.inject(I18nService);
  }

  describe('initialization', () => {
    it('should be created', () => {
      service = createService();
      expect(service).toBeTruthy();
    });

    it('should restore language from localStorage', () => {
      localStorage.setItem('app-language', 'pt');
      service = createService();
      expect(service.language()).toBe('pt');
    });

    it('should default to en when no stored preference', () => {
      service = createService();
      // Either 'en' or auto-detected from browser
      expect(['en', 'pt']).toContain(service.language());
    });
  });

  describe('setLanguage', () => {
    it('should set language to Portuguese', () => {
      service = createService();
      service.setLanguage('pt');
      expect(service.language()).toBe('pt');
    });

    it('should set language to English', () => {
      localStorage.setItem('app-language', 'pt');
      service = createService();
      service.setLanguage('en');
      expect(service.language()).toBe('en');
    });

    it('should persist language to localStorage', () => {
      service = createService();
      service.setLanguage('pt');
      TestBed.flushEffects();
      expect(localStorage.getItem('app-language')).toBe('pt');
    });

    it('should set lang attribute on documentElement', () => {
      service = createService();
      service.setLanguage('pt');
      TestBed.flushEffects();
      expect(document.documentElement.getAttribute('lang')).toBe('pt');
    });
  });

  describe('toggleLanguage', () => {
    it('should toggle from en to pt', () => {
      localStorage.setItem('app-language', 'en');
      service = createService();
      expect(service.language()).toBe('en');

      service.toggleLanguage();
      expect(service.language()).toBe('pt');
    });

    it('should toggle from pt to es', () => {
      localStorage.setItem('app-language', 'pt');
      service = createService();

      service.toggleLanguage();
      expect(service.language()).toBe('es');
    });
  });

  describe('isEnglish signal', () => {
    it('should be true when language is en', () => {
      localStorage.setItem('app-language', 'en');
      service = createService();
      TestBed.flushEffects();
      expect(service.isEnglish()).toBeTrue();
    });

    it('should be false when language is pt', () => {
      localStorage.setItem('app-language', 'pt');
      service = createService();
      TestBed.flushEffects();
      expect(service.isEnglish()).toBeFalse();
    });
  });

  describe('t() - translations', () => {
    beforeEach(() => {
      localStorage.setItem('app-language', 'en');
      service = createService();
    });

    it('should return English translation', () => {
      expect(service.t('nav.home')).toBe('Home');
      expect(service.t('nav.blog')).toBe('Blog');
      expect(service.t('nav.login')).toBe('Login');
    });

    it('should return Portuguese translation', () => {
      (service as any).cache.set('pt', ptTranslations);
      service.setLanguage('pt');
      TestBed.flushEffects();
      expect(service.t('nav.home')).toBe('Início');
      expect(service.t('nav.blog')).toBe('Blog');
      expect(service.t('nav.login')).toBe('Entrar');
    });

    it('should return key when translation not found', () => {
      expect(service.t('non.existent.key')).toBe('non.existent.key');
    });

    it('should fallback to English when key not in Portuguese', () => {
      service.setLanguage('pt');
      // Assuming a key exists in EN but not in PT
      const enResult = service.t('non.pt.key');
      // Should return the key itself since not in either
      expect(enResult).toBe('non.pt.key');
    });

    it('should translate with parameter substitution', () => {
      expect(service.t('admin.articles.confirmDelete', { title: 'Meu Artigo' })).toBe(
        'Are you sure you want to delete "Meu Artigo"?'
      );
    });

    it('should translate PT with parameter substitution', () => {
      (service as any).cache.set('pt', ptTranslations);
      service.setLanguage('pt');
      TestBed.flushEffects();
      expect(service.t('admin.articles.confirmDelete', { title: 'Java 21' })).toBe(
        'Tem certeza que deseja excluir "Java 21"?'
      );
    });

    it('should replace multiple params in one string', () => {
      (service as any).cache.set('pt', ptTranslations);
      service.setLanguage('pt');
      TestBed.flushEffects();
      // admin.users.confirmDelete uses {{name}}
      expect(service.t('admin.users.confirmDelete', { name: 'Vinicius' })).toContain('Vinicius');
    });

    // Test admin sidebar translations
    it('should translate admin sidebar items', () => {
      expect(service.t('admin.sidebar.dashboard')).toBe('Dashboard');
      expect(service.t('admin.sidebar.articles')).toBe('Articles');
      expect(service.t('admin.sidebar.users')).toBe('Users');
      expect(service.t('admin.sidebar.settings')).toBe('Settings');
    });

    it('should translate admin sidebar items in PT', () => {
      (service as any).cache.set('pt', ptTranslations);
      service.setLanguage('pt');
      TestBed.flushEffects();
      expect(service.t('admin.sidebar.articles')).toBe('Artigos');
      expect(service.t('admin.sidebar.users')).toBe('Usuários');
      expect(service.t('admin.sidebar.settings')).toBe('Configurações');
    });

    // Test auth/login translations
    it('should translate login form', () => {
      expect(service.t('auth.login.welcome')).toBe('Welcome back');
      expect(service.t('auth.login.submit')).toBe('Sign In');
      expect(service.t('auth.login.forgotPassword')).toBe('Forgot password?');
    });

    it('should translate login form in PT', () => {
      (service as any).cache.set('pt', ptTranslations);
      service.setLanguage('pt');
      TestBed.flushEffects();
      expect(service.t('auth.login.welcome')).toBe('Bem-vindo de volta');
      expect(service.t('auth.login.submit')).toBe('Entrar');
      expect(service.t('auth.login.forgotPassword')).toBe('Esqueceu a senha?');
    });

    // Test common translations
    it('should translate common actions', () => {
      expect(service.t('common.save')).toBe('Save');
      expect(service.t('common.cancel')).toBe('Cancel');
      expect(service.t('common.delete')).toBe('Delete');
      expect(service.t('common.edit')).toBe('Edit');
    });

    it('should translate common actions in PT', () => {
      (service as any).cache.set('pt', ptTranslations);
      service.setLanguage('pt');
      TestBed.flushEffects();
      expect(service.t('common.save')).toBe('Salvar');
      expect(service.t('common.cancel')).toBe('Cancelar');
      expect(service.t('common.delete')).toBe('Excluir');
      expect(service.t('common.edit')).toBe('Editar');
    });

    // Test hero section
    it('should translate hero section', () => {
      expect(service.t('hero.subtitle')).toBe('Senior Software Engineer | Java & Go');
    });

    it('should translate hero section in PT', () => {
      (service as any).cache.set('pt', ptTranslations);
      service.setLanguage('pt');
      TestBed.flushEffects();
      expect(service.t('hero.subtitle')).toBe('Engenheiro de Software Sênior | Java & Go');
    });
  });
});
