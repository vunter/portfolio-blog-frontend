import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { LoginResponse, UserResponse } from '../../models';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const baseUrl = '/api/v1';

  const mockLoginResponse: LoginResponse = {
    tokenType: 'Bearer',
    expiresIn: 3600,
    email: 'admin@catananti.dev',
    name: 'Vinicius Catananti',
  };

  const mockUser: UserResponse = {
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('login', () => {
    it('should send POST to /admin/auth/login/v2 with credentials', () => {
      const credentials = { email: 'admin@catananti.dev', password: 'admin123456789' };

      service.login(credentials).subscribe((response) => {
        expect(response).toEqual(mockLoginResponse);
        expect(response.email).toBe('admin@catananti.dev');
        expect(response.tokenType).toBe('Bearer');
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/auth/login/v2`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(credentials);
      expect(req.request.withCredentials).toBeTrue();
      req.flush(mockLoginResponse);
    });

    it('should handle 401 for invalid credentials', () => {
      const credentials = { email: 'admin@catananti.dev', password: 'wrongpassword' };

      service.login(credentials).subscribe({
        error: (err) => {
          expect(err.status).toBe(401);
        },
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/auth/login/v2`);
      req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    });

    it('should handle 429 for too many attempts', () => {
      const credentials = { email: 'admin@catananti.dev', password: 'admin123456789' };

      service.login(credentials).subscribe({
        error: (err) => {
          expect(err.status).toBe(429);
        },
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/auth/login/v2`);
      req.flush({ message: 'Too many login attempts' }, { status: 429, statusText: 'Too Many Requests' });
    });
  });

  describe('refreshToken', () => {
    it('should send POST to /admin/auth/refresh with withCredentials', () => {
      service.refreshToken().subscribe((response) => {
        expect(response).toEqual(mockLoginResponse);
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/auth/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();
      expect(req.request.body).toEqual({});
      req.flush(mockLoginResponse);
    });

    it('should accept custom body', () => {
      const body = { hint: 'custom' };

      service.refreshToken(body).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/auth/refresh`);
      expect(req.request.body).toEqual(body);
      req.flush(mockLoginResponse);
    });
  });

  describe('logout', () => {
    it('should send POST to /admin/auth/logout with withCredentials', () => {
      service.logout().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/auth/logout`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();
      expect(req.request.body).toEqual({});
      req.flush(null);
    });
  });

  describe('requestPasswordReset', () => {
    it('should send POST to /admin/auth/forgot-password', () => {
      const request = { email: 'admin@catananti.dev' };

      service.requestPasswordReset(request).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/auth/forgot-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(null);
    });
  });

  describe('confirmPasswordReset', () => {
    it('should send POST to /admin/auth/reset-password', () => {
      const request = { token: 'abc123resettoken', newPassword: 'NewSecure@Pass2025' };

      service.confirmPasswordReset(request).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/auth/reset-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(null);
    });
  });

  describe('validateResetToken', () => {
    it('should send GET to /admin/auth/reset-password/validate with token param', () => {
      const token = 'abc123resettoken';

      service.validateResetToken(token).subscribe((response) => {
        expect(response.valid).toBeTrue();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/admin/auth/reset-password/validate?token=${token}`
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('token')).toBe(token);
      req.flush({ valid: true });
    });

    it('should return false for expired token', () => {
      const token = 'expiredtoken';

      service.validateResetToken(token).subscribe((response) => {
        expect(response.valid).toBeFalse();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/admin/auth/reset-password/validate?token=${token}`
      );
      req.flush({ valid: false });
    });
  });

  describe('getCurrentUser', () => {
    it('should send GET to /admin/users/me with withCredentials', () => {
      service.getCurrentUser().subscribe((user) => {
        expect(user).toEqual(mockUser);
        expect(user.role).toBe('ADMIN');
        expect(user.active).toBeTrue();
        expect(user.email).toBe('admin@catananti.dev');
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/users/me`);
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBeTrue();
      req.flush(mockUser);
    });

    it('should handle 401 when not authenticated', () => {
      service.getCurrentUser().subscribe({
        error: (err) => {
          expect(err.status).toBe(401);
        },
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/users/me`);
      req.flush(null, { status: 401, statusText: 'Unauthorized' });
    });
  });
});
