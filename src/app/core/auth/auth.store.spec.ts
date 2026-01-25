import { TestBed } from '@angular/core/testing';
import { AuthStore } from './auth.store';
import { StorageService } from '../services/storage.service';
import { AuthService } from './auth.service';
import { UserResponse } from '../../models';
import { of } from 'rxjs';

describe('AuthStore', () => {
  let store: InstanceType<typeof AuthStore>;
  let storageSpy: jasmine.SpyObj<StorageService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  const mockAdmin: UserResponse = {
    id: '1840234567890123456',
    username: 'vcatananti',
    email: 'admin@catananti.dev',
    name: 'Vinicius Catananti',
    avatarUrl: 'https://github.com/vcatananti.png',
    bio: 'Senior Software Engineer | Java & Go',
    role: 'ADMIN',
    active: true,
    createdAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-07-20T14:00:00Z',
  };

  const mockDev: UserResponse = {
    id: '1840234567890123457',
    username: 'devuser',
    email: 'dev@catananti.dev',
    name: 'Dev User',
    role: 'DEV',
    active: true,
    createdAt: '2025-03-10T08:00:00Z',
    updatedAt: '2025-07-15T12:00:00Z',
  };

  const mockEditor: UserResponse = {
    id: '1840234567890123458',
    username: 'editoruser',
    email: 'editor@catananti.dev',
    name: 'Editor User',
    role: 'EDITOR',
    active: true,
    createdAt: '2025-04-20T09:00:00Z',
    updatedAt: '2025-07-10T11:00:00Z',
  };

  const mockViewer: UserResponse = {
    id: '1840234567890123459',
    username: 'vieweruser',
    email: 'viewer@catananti.dev',
    name: 'Viewer User',
    role: 'VIEWER',
    active: true,
    createdAt: '2025-05-01T10:00:00Z',
    updatedAt: '2025-07-05T10:00:00Z',
  };

  beforeEach(() => {
    storageSpy = jasmine.createSpyObj('StorageService', [
      'get',
      'set',
      'remove',
      'getSession',
      'setSession',
      'removeSession',
    ]);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['logout']);
    authServiceSpy.logout.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        { provide: StorageService, useValue: storageSpy },
        { provide: AuthService, useValue: authServiceSpy },
      ],
    });

    store = TestBed.inject(AuthStore);
  });

  it('should be created with initial state', () => {
    expect(store).toBeTruthy();
    expect(store.user()).toBeNull();
    expect(store.isAuthenticated()).toBeFalse();
    expect(store.isLoading()).toBeFalse();
    expect(store.error()).toBeNull();
  });

  describe('login', () => {
    it('should set user and isAuthenticated on login', () => {
      store.login(mockAdmin);

      expect(store.user()).toEqual(mockAdmin);
      expect(store.isAuthenticated()).toBeTrue();
      expect(store.isLoading()).toBeFalse();
      expect(store.error()).toBeNull();
    });

    it('should store user in localStorage', () => {
      store.login(mockAdmin);

      expect(storageSpy.set).toHaveBeenCalledWith('user', mockAdmin);
      expect(storageSpy.set).toHaveBeenCalledWith('isAuthenticated', true);
    });
  });

  describe('logout', () => {
    it('should clear state on logout', () => {
      store.login(mockAdmin);
      store.logout();

      expect(store.user()).toBeNull();
      expect(store.isAuthenticated()).toBeFalse();
    });

    it('should clear localStorage on logout', () => {
      store.login(mockAdmin);
      store.logout();

      expect(storageSpy.remove).toHaveBeenCalledWith('user');
      expect(storageSpy.remove).toHaveBeenCalledWith('isAuthenticated');
    });

    it('should call authService.logout on backend', () => {
      store.login(mockAdmin);
      store.logout();

      expect(authServiceSpy.logout).toHaveBeenCalled();
    });
  });

  describe('setAuthenticated', () => {
    it('should set isAuthenticated to true', () => {
      store.setAuthenticated();

      expect(store.isAuthenticated()).toBeTrue();
      expect(storageSpy.set).toHaveBeenCalledWith('isAuthenticated', true);
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      store.setLoading(true);
      expect(store.isLoading()).toBeTrue();

      store.setLoading(false);
      expect(store.isLoading()).toBeFalse();
    });
  });

  describe('setError', () => {
    it('should set error and clear loading', () => {
      store.setLoading(true);
      store.setError('Login falhou');

      expect(store.error()).toBe('Login falhou');
      expect(store.isLoading()).toBeFalse();
    });

    it('should clear error when null', () => {
      store.setError('Erro');
      store.setError(null);

      expect(store.error()).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user data and localStorage', () => {
      store.login(mockAdmin);

      const updatedUser = { ...mockAdmin, name: 'Vinicius Updated' };
      store.updateUser(updatedUser);

      expect(store.user()?.name).toBe('Vinicius Updated');
      expect(storageSpy.set).toHaveBeenCalledWith('user', updatedUser);
    });
  });

  describe('initFromStorage', () => {
    it('should restore state from localStorage', () => {
      storageSpy.get.and.callFake(<T>(key: string): T | null => {
        if (key === 'isAuthenticated') return true as unknown as T;
        if (key === 'user') return mockAdmin as unknown as T;
        return null;
      });
      storageSpy.getSession.and.returnValue(null);
      authServiceSpy.getCurrentUser = jasmine.createSpy().and.returnValue(of(mockAdmin));

      store.initFromStorage();

      expect(store.user()).toEqual(mockAdmin);
      expect(store.isAuthenticated()).toBeTrue();
    });

    it('should fall back to sessionStorage for legacy migration', () => {
      storageSpy.get.and.returnValue(null);
      storageSpy.getSession.and.callFake(<T>(key: string): T | null => {
        if (key === 'isAuthenticated') return true as unknown as T;
        if (key === 'user') return mockAdmin as unknown as T;
        return null;
      });
      authServiceSpy.getCurrentUser = jasmine.createSpy().and.returnValue(of(mockAdmin));

      store.initFromStorage();

      expect(store.user()).toEqual(mockAdmin);
      expect(store.isAuthenticated()).toBeTrue();
      // Should migrate to localStorage
      expect(storageSpy.set).toHaveBeenCalledWith('user', mockAdmin);
      expect(storageSpy.set).toHaveBeenCalledWith('isAuthenticated', true);
    });

    it('should not restore if not authenticated in storage', () => {
      storageSpy.get.and.returnValue(null);
      storageSpy.getSession.and.returnValue(null);

      store.initFromStorage();

      expect(store.user()).toBeNull();
      expect(store.isAuthenticated()).toBeFalse();
    });

    it('should not restore if user is missing from storage', () => {
      storageSpy.get.and.callFake(<T>(key: string): T | null => {
        if (key === 'isAuthenticated') return true as unknown as T;
        return null;
      });
      storageSpy.getSession.and.returnValue(null);

      store.initFromStorage();

      expect(store.user()).toBeNull();
      expect(store.isAuthenticated()).toBeFalse();
    });
  });

  describe('computed: isAdmin', () => {
    it('should return true for ADMIN role', () => {
      store.login(mockAdmin);
      expect(store.isAdmin()).toBeTrue();
    });

    it('should return false for DEV role', () => {
      store.login(mockDev);
      expect(store.isAdmin()).toBeFalse();
    });

    it('should return false for EDITOR role', () => {
      store.login(mockEditor);
      expect(store.isAdmin()).toBeFalse();
    });

    it('should return false for VIEWER role', () => {
      store.login(mockViewer);
      expect(store.isAdmin()).toBeFalse();
    });

    it('should return false when not logged in', () => {
      expect(store.isAdmin()).toBeFalse();
    });
  });

  describe('computed: isDev', () => {
    it('should return true for ADMIN role', () => {
      store.login(mockAdmin);
      expect(store.isDev()).toBeTrue();
    });

    it('should return true for DEV role', () => {
      store.login(mockDev);
      expect(store.isDev()).toBeTrue();
    });

    it('should return false for EDITOR role', () => {
      store.login(mockEditor);
      expect(store.isDev()).toBeFalse();
    });

    it('should return false for VIEWER role', () => {
      store.login(mockViewer);
      expect(store.isDev()).toBeFalse();
    });
  });

  describe('computed: isEditor', () => {
    it('should return true for ADMIN role', () => {
      store.login(mockAdmin);
      expect(store.isEditor()).toBeTrue();
    });

    it('should return true for DEV role', () => {
      store.login(mockDev);
      expect(store.isEditor()).toBeTrue();
    });

    it('should return true for EDITOR role', () => {
      store.login(mockEditor);
      expect(store.isEditor()).toBeTrue();
    });

    it('should return false for VIEWER role', () => {
      store.login(mockViewer);
      expect(store.isEditor()).toBeFalse();
    });
  });

  describe('computed: userDisplayName', () => {
    it('should return name when available', () => {
      store.login(mockAdmin);
      expect(store.userDisplayName()).toBe('Vinicius Catananti');
    });

    it('should return username when name is empty', () => {
      const userNoName = { ...mockAdmin, name: '' };
      store.login(userNoName);
      expect(store.userDisplayName()).toBe('vcatananti');
    });

    it('should return "User" when no name or username', () => {
      const userNoInfo = { ...mockAdmin, name: '', username: '' };
      store.login(userNoInfo);
      expect(store.userDisplayName()).toBe('User');
    });
  });

  describe('computed: userInitials', () => {
    it('should return initials from full name', () => {
      store.login(mockAdmin);
      expect(store.userInitials()).toBe('VC');
    });

    it('should return single initial for single name', () => {
      const singleName = { ...mockAdmin, name: 'Vinicius' };
      store.login(singleName);
      expect(store.userInitials()).toBe('V');
    });

    it('should limit to 2 characters', () => {
      const longName = { ...mockAdmin, name: 'Vinicius Souza Catananti' };
      store.login(longName);
      expect(store.userInitials()).toBe('VS');
    });
  });
});
