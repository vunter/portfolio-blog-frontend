import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthStore } from './auth.store';
import { StorageService } from '../services/storage.service';
import { AuthService } from './auth.service';
import { authGuard, guestGuard, adminGuard, devGuard, editorGuard } from './auth.guard';
import { UserResponse } from '../../models';
import { of } from 'rxjs';

describe('Auth Guards', () => {
  let store: InstanceType<typeof AuthStore>;
  let router: jasmine.SpyObj<Router>;

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = { url: '/admin/dashboard' } as RouterStateSnapshot;
  const mockRootState = { url: '/' } as RouterStateSnapshot;

  const createUser = (role: 'ADMIN' | 'DEV' | 'EDITOR' | 'VIEWER'): UserResponse => ({
    id: '1840234567890123456',
    username: `${role.toLowerCase()}user`,
    email: `${role.toLowerCase()}@catananti.dev`,
    name: `${role} User`,
    role,
    active: true,
    createdAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-07-20T14:00:00Z',
  });

  beforeEach(() => {
    router = jasmine.createSpyObj('Router', ['navigate']);
    const storageSpy = jasmine.createSpyObj('StorageService', [
      'getSession', 'setSession', 'removeSession',
    ]);
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['logout', 'refreshToken']);
    authServiceSpy.logout.and.returnValue(of(undefined));
    authServiceSpy.refreshToken.and.returnValue(of({ expiresIn: 3600 }));

    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        { provide: Router, useValue: router },
        { provide: StorageService, useValue: storageSpy },
        { provide: AuthService, useValue: authServiceSpy },
      ],
    });

    store = TestBed.inject(AuthStore);
  });

  /** Login and set a future token expiry so isTokenExpired() returns false */
  function loginUser(role: 'ADMIN' | 'DEV' | 'EDITOR' | 'VIEWER') {
    store.login(createUser(role));
    store.setTokenExpiry(3600);
  }

  // ==========================================
  // authGuard
  // ==========================================
  describe('authGuard', () => {
    it('should allow authenticated user', () => {
      loginUser('VIEWER');

      const result = TestBed.runInInjectionContext(() =>
        authGuard(mockRoute, mockState)
      );
      expect(result).toBeTrue();
    });

    it('should redirect unauthenticated user to login with returnUrl', () => {
      const result = TestBed.runInInjectionContext(() =>
        authGuard(mockRoute, mockState)
      );

      expect(result).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { returnUrl: '/admin/dashboard' },
      });
    });

    it('should allow any role (ADMIN)', () => {
      loginUser('ADMIN');

      const result = TestBed.runInInjectionContext(() =>
        authGuard(mockRoute, mockState)
      );
      expect(result).toBeTrue();
    });

    it('should allow any role (DEV)', () => {
      loginUser('DEV');

      const result = TestBed.runInInjectionContext(() =>
        authGuard(mockRoute, mockState)
      );
      expect(result).toBeTrue();
    });
  });

  // ==========================================
  // guestGuard
  // ==========================================
  describe('guestGuard', () => {
    it('should allow unauthenticated user', () => {
      const result = TestBed.runInInjectionContext(() =>
        guestGuard(mockRoute, mockState)
      );
      expect(result).toBeTrue();
    });

    it('should redirect authenticated user to home', () => {
      loginUser('ADMIN');

      const result = TestBed.runInInjectionContext(() =>
        guestGuard(mockRoute, mockState)
      );

      expect(result).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });
  });

  // ==========================================
  // adminGuard
  // ==========================================
  describe('adminGuard', () => {
    it('should allow ADMIN role', () => {
      loginUser('ADMIN');

      const result = TestBed.runInInjectionContext(() =>
        adminGuard(mockRoute, mockState)
      );
      expect(result).toBeTrue();
    });

    it('should block DEV role', () => {
      loginUser('DEV');

      const result = TestBed.runInInjectionContext(() =>
        adminGuard(mockRoute, mockState)
      );

      expect(result).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should block EDITOR role', () => {
      loginUser('EDITOR');

      const result = TestBed.runInInjectionContext(() =>
        adminGuard(mockRoute, mockState)
      );

      expect(result).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should block VIEWER role', () => {
      loginUser('VIEWER');

      const result = TestBed.runInInjectionContext(() =>
        adminGuard(mockRoute, mockState)
      );

      expect(result).toBeFalse();
    });

    it('should redirect unauthenticated to login', () => {
      const result = TestBed.runInInjectionContext(() =>
        adminGuard(mockRoute, mockState)
      );

      expect(result).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { returnUrl: '/admin/dashboard' },
      });
    });
  });

  // ==========================================
  // devGuard
  // ==========================================
  describe('devGuard', () => {
    it('should allow ADMIN role', () => {
      loginUser('ADMIN');

      const result = TestBed.runInInjectionContext(() =>
        devGuard(mockRoute, mockState)
      );
      expect(result).toBeTrue();
    });

    it('should allow DEV role', () => {
      loginUser('DEV');

      const result = TestBed.runInInjectionContext(() =>
        devGuard(mockRoute, mockState)
      );
      expect(result).toBeTrue();
    });

    it('should block EDITOR role', () => {
      loginUser('EDITOR');

      const result = TestBed.runInInjectionContext(() =>
        devGuard(mockRoute, mockState)
      );

      expect(result).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should block VIEWER role', () => {
      loginUser('VIEWER');

      const result = TestBed.runInInjectionContext(() =>
        devGuard(mockRoute, mockState)
      );

      expect(result).toBeFalse();
    });

    it('should redirect unauthenticated to login', () => {
      const result = TestBed.runInInjectionContext(() =>
        devGuard(mockRoute, mockState)
      );

      expect(result).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { returnUrl: '/admin/dashboard' },
      });
    });
  });

  // ==========================================
  // editorGuard
  // ==========================================
  describe('editorGuard', () => {
    it('should allow ADMIN role', () => {
      loginUser('ADMIN');

      const result = TestBed.runInInjectionContext(() =>
        editorGuard(mockRoute, mockState)
      );
      expect(result).toBeTrue();
    });

    it('should allow DEV role', () => {
      loginUser('DEV');

      const result = TestBed.runInInjectionContext(() =>
        editorGuard(mockRoute, mockState)
      );
      expect(result).toBeTrue();
    });

    it('should allow EDITOR role', () => {
      loginUser('EDITOR');

      const result = TestBed.runInInjectionContext(() =>
        editorGuard(mockRoute, mockState)
      );
      expect(result).toBeTrue();
    });

    it('should block VIEWER role', () => {
      loginUser('VIEWER');

      const result = TestBed.runInInjectionContext(() =>
        editorGuard(mockRoute, mockState)
      );

      expect(result).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should redirect unauthenticated to login', () => {
      const result = TestBed.runInInjectionContext(() =>
        editorGuard(mockRoute, mockState)
      );

      expect(result).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { returnUrl: '/admin/dashboard' },
      });
    });
  });
});
