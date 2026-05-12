import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  const baseUrl = '/api/v1';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApiService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('get', () => {
    it('should send GET request to correct URL', () => {
      service.get('/articles').subscribe((data) => {
        expect(data).toEqual({ content: [] });
      });

      const req = httpMock.expectOne(`${baseUrl}/articles`);
      expect(req.request.method).toBe('GET');
      req.flush({ content: [] });
    });

    it('should append query params', () => {
      service.get('/articles', { page: 0, size: 10, status: 'PUBLISHED' }).subscribe();

      const req = httpMock.expectOne(
        `${baseUrl}/articles?page=0&size=10&status=PUBLISHED`
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('10');
      expect(req.request.params.get('status')).toBe('PUBLISHED');
      req.flush({ content: [] });
    });

    it('should handle boolean query params', () => {
      service.get('/articles', { featured: true }).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/articles?featured=true`);
      expect(req.request.params.get('featured')).toBe('true');
      req.flush({ content: [] });
    });

    it('should work without query params', () => {
      service.get('/tags').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/tags`);
      expect(req.request.params.keys().length).toBe(0);
      req.flush([]);
    });
  });

  describe('post', () => {
    it('should send POST with body', () => {
      const body = { name: 'Java', description: 'Linguagem de programação', color: '#E76F00' };

      service.post('/admin/tags', body).subscribe((response) => {
        expect(response).toEqual({ id: '1', name: 'Java' });
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/tags`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: '1', name: 'Java' });
    });

    it('should send POST without body', () => {
      service.post('/admin/cache/clear').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/cache/clear`);
      expect(req.request.method).toBe('POST');
      // When no body is passed, Angular sends null
      expect(req.request.body).toBeNull();
      req.flush(null);
    });
  });

  describe('put', () => {
    it('should send PUT with body', () => {
      const body = { name: 'Java 21+', color: '#E76F00' };

      service.put('/admin/tags/1', body).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/tags/1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush({ id: '1', name: 'Java 21+' });
    });
  });

  describe('patch', () => {
    it('should send PATCH with body', () => {
      const body = { role: 'DEV' };

      service.patch('/admin/users/123/role', body).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/users/123/role`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(body);
      req.flush({ message: 'Role updated' });
    });

    it('should send PATCH without body', () => {
      service.patch('/admin/comments/1/approve').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/comments/1/approve`);
      expect(req.request.method).toBe('PATCH');
      req.flush({ message: 'Approved' });
    });
  });

  describe('delete', () => {
    it('should send DELETE request', () => {
      service.delete('/admin/articles/1').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/articles/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('cachedGet', () => {
    it('should return cached data on second call within TTL', () => {
      const mockData = { id: 1, name: 'Test' };
      let callCount = 0;

      // First call — cache miss
      service.cachedGet('/articles/1').subscribe((data) => {
        expect(data).toEqual(mockData);
        callCount++;
      });
      httpMock.expectOne(`${baseUrl}/articles/1`).flush(mockData);

      // Second call — should return cached data, no HTTP request
      service.cachedGet('/articles/1').subscribe((data) => {
        expect(data).toEqual(mockData);
        callCount++;
      });
      httpMock.expectNone(`${baseUrl}/articles/1`);
      expect(callCount).toBe(2);
    });

    it('should deduplicate concurrent in-flight requests', () => {
      const mockData = { id: 1 };

      // Two concurrent calls
      service.cachedGet('/tags').subscribe();
      service.cachedGet('/tags').subscribe();

      // Only one HTTP request should be made
      const reqs = httpMock.match(`${baseUrl}/tags`);
      expect(reqs.length).toBe(1);
      reqs[0].flush(mockData);
    });

    it('should include query params in cache key', () => {
      service.cachedGet('/articles', { status: 'PUBLISHED' }).subscribe();
      service.cachedGet('/articles', { status: 'DRAFT' }).subscribe();

      // Different params = different cache keys = two HTTP requests
      const reqs = httpMock.match(r => r.url.includes('/articles'));
      expect(reqs.length).toBe(2);
      expect(reqs[0].request.params.get('status')).toBe('PUBLISHED');
      expect(reqs[1].request.params.get('status')).toBe('DRAFT');
      reqs[0].flush([]);
      reqs[1].flush([]);
    });
  });

  describe('invalidateCache', () => {
    it('should clear all cached entries when called without prefix', () => {
      const mockData = { id: 1 };

      // Populate cache
      service.cachedGet('/articles/1').subscribe();
      httpMock.expectOne(`${baseUrl}/articles/1`).flush(mockData);

      // Invalidate
      service.invalidateCache();

      // Next call should make a new request (proves cache was cleared)
      service.cachedGet('/articles/1').subscribe();
      expect(httpMock.match(`${baseUrl}/articles/1`).length).toBe(1);
    });

    it('should clear only matching prefix entries', () => {
      // Populate cache with two different endpoints
      service.cachedGet('/articles/1').subscribe();
      httpMock.expectOne(`${baseUrl}/articles/1`).flush({ id: 1 });

      service.cachedGet('/tags').subscribe();
      httpMock.expectOne(`${baseUrl}/tags`).flush([]);

      // Invalidate only articles
      service.invalidateCache('/articles');

      // Articles should need a new request
      service.cachedGet('/articles/1').subscribe();
      expect(httpMock.match(`${baseUrl}/articles/1`).length).toBe(1);

      // Tags should still be cached — no new HTTP request
      service.cachedGet('/tags').subscribe();
      expect(httpMock.match(`${baseUrl}/tags`).length).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should propagate 404 errors', () => {
      service.get('/articles/nonexistent-slug').subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        },
      });

      const req = httpMock.expectOne(`${baseUrl}/articles/nonexistent-slug`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });

    it('should propagate 500 errors', () => {
      service.post('/admin/articles', { title: 'Test' }).subscribe({
        error: (err) => {
          expect(err.status).toBe(500);
        },
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/articles`);
      req.flush({ message: 'Internal error' }, { status: 500, statusText: 'Internal Server Error' });
    });
  });
});
