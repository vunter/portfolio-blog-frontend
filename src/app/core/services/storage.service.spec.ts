import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        StorageService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    service = TestBed.inject(StorageService);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- localStorage ---

  describe('localStorage: get', () => {
    it('should return stored object', () => {
      localStorage.setItem('user', JSON.stringify({ name: 'Vinicius' }));

      const result = service.get<{ name: string }>('user');
      expect(result).toEqual({ name: 'Vinicius' });
    });

    it('should return null for non-existent key', () => {
      expect(service.get('nonexistent')).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      localStorage.setItem('broken', '{invalid json');
      expect(service.get('broken')).toBeNull();
    });

    it('should return stored primitive values', () => {
      localStorage.setItem('count', JSON.stringify(42));
      expect(service.get<number>('count')).toBe(42);

      localStorage.setItem('flag', JSON.stringify(true));
      expect(service.get<boolean>('flag')).toBeTrue();

      localStorage.setItem('text', JSON.stringify('hello'));
      expect(service.get<string>('text')).toBe('hello');
    });
  });

  describe('localStorage: set', () => {
    it('should store object as JSON', () => {
      const user = { id: '123', name: 'Vinicius Catananti', role: 'ADMIN' };
      service.set('user', user);

      const stored = JSON.parse(localStorage.getItem('user')!);
      expect(stored).toEqual(user);
    });

    it('should store primitive values', () => {
      service.set('theme', 'dark');
      expect(JSON.parse(localStorage.getItem('theme')!)).toBe('dark');

      service.set('count', 10);
      expect(JSON.parse(localStorage.getItem('count')!)).toBe(10);
    });

    it('should overwrite existing value', () => {
      service.set('theme', 'dark');
      service.set('theme', 'light');

      expect(JSON.parse(localStorage.getItem('theme')!)).toBe('light');
    });
  });

  describe('localStorage: remove', () => {
    it('should remove stored item', () => {
      service.set('theme', 'dark');
      service.remove('theme');

      expect(localStorage.getItem('theme')).toBeNull();
    });

    it('should handle removing non-existent key gracefully', () => {
      expect(() => service.remove('nonexistent')).not.toThrow();
    });
  });

  describe('localStorage: clear', () => {
    it('should clear all localStorage items', () => {
      service.set('a', 1);
      service.set('b', 2);
      service.set('c', 3);

      service.clear();

      expect(localStorage.length).toBe(0);
    });
  });

  // --- sessionStorage ---

  describe('sessionStorage: getSession', () => {
    it('should return stored session object', () => {
      sessionStorage.setItem('user', JSON.stringify({ email: 'admin@catananti.dev' }));

      const result = service.getSession<{ email: string }>('user');
      expect(result).toEqual({ email: 'admin@catananti.dev' });
    });

    it('should return null for non-existent session key', () => {
      expect(service.getSession('nonexistent')).toBeNull();
    });

    it('should return null for invalid JSON in session', () => {
      sessionStorage.setItem('broken', 'not-json');
      expect(service.getSession('broken')).toBeNull();
    });
  });

  describe('sessionStorage: setSession', () => {
    it('should store in sessionStorage', () => {
      const user = {
        id: '1840234567890123456',
        email: 'admin@catananti.dev',
        role: 'ADMIN',
      };
      service.setSession('user', user);

      const stored = JSON.parse(sessionStorage.getItem('user')!);
      expect(stored).toEqual(user);
    });

    it('should store boolean in session', () => {
      service.setSession('isAuthenticated', true);
      expect(JSON.parse(sessionStorage.getItem('isAuthenticated')!)).toBeTrue();
    });
  });

  describe('sessionStorage: removeSession', () => {
    it('should remove session item', () => {
      service.setSession('user', { name: 'Test' });
      service.removeSession('user');

      expect(sessionStorage.getItem('user')).toBeNull();
    });
  });

  // --- SSR safety ---

  describe('SSR (server-side) safety', () => {
    let serverService: StorageService;

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          StorageService,
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });
      serverService = TestBed.inject(StorageService);
    });

    it('should return null for get on server', () => {
      expect(serverService.get('any')).toBeNull();
    });

    it('should not throw on set on server', () => {
      expect(() => serverService.set('key', 'value')).not.toThrow();
    });

    it('should not throw on remove on server', () => {
      expect(() => serverService.remove('key')).not.toThrow();
    });

    it('should return null for getSession on server', () => {
      expect(serverService.getSession('any')).toBeNull();
    });

    it('should not throw on setSession on server', () => {
      expect(() => serverService.setSession('key', 'value')).not.toThrow();
    });

    it('should not throw on removeSession on server', () => {
      expect(() => serverService.removeSession('key')).not.toThrow();
    });
  });
});
