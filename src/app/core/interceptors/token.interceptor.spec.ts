import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptors,
  HttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { tokenInterceptor } from './token.interceptor';

describe('tokenInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tokenInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should add withCredentials to API requests', () => {
    http.get('/api/v1/articles').subscribe();

    const req = httpMock.expectOne('/api/v1/articles');
    expect(req.request.withCredentials).toBeTrue();
    req.flush([]);
  });

  it('should add withCredentials to admin API requests', () => {
    http.get('/api/v1/admin/users').subscribe();

    const req = httpMock.expectOne('/api/v1/admin/users');
    expect(req.request.withCredentials).toBeTrue();
    req.flush([]);
  });

  it('should add withCredentials to POST requests', () => {
    http.post('/api/v1/admin/auth/login', { email: 'admin@catananti.dev', password: 'test' }).subscribe();

    const req = httpMock.expectOne('/api/v1/admin/auth/login');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({});
  });

  it('should not add withCredentials to external URLs', () => {
    http.get('https://api.github.com/users/vcatananti').subscribe();

    const req = httpMock.expectOne('https://api.github.com/users/vcatananti');
    expect(req.request.withCredentials).toBeFalse();
    req.flush({});
  });

  it('should not modify non-API requests', () => {
    http.get('https://cdn.example.com/image.png').subscribe();

    const req = httpMock.expectOne('https://cdn.example.com/image.png');
    expect(req.request.withCredentials).toBeFalse();
    req.flush(null);
  });
});
