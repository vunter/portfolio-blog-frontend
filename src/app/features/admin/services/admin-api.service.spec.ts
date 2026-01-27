import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AdminApiService, DashboardStats, AdminArticle, AdminComment, ContactMessage, NewsletterStats, CacheStats, AnalyticsSummary } from './admin-api.service';
import { PageResponse, TagResponse, UserResponse } from '../../../models';

describe('AdminApiService', () => {
  let service: AdminApiService;
  let httpMock: HttpTestingController;

  const baseUrl = '/api/v1';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AdminApiService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AdminApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ==================== DASHBOARD ====================

  describe('getDashboardStats', () => {
    it('should GET /admin/dashboard/stats', () => {
      const mockStats: DashboardStats = {
        totalArticles: 25,
        totalViews: 5000,
        totalComments: 120,
        totalSubscribers: 50,
        recentArticles: 3,
        pendingComments: 5,
      };

      service.getDashboardStats().subscribe((stats) => {
        expect(stats).toEqual(mockStats);
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/dashboard/stats`);
      expect(req.request.method).toBe('GET');
      req.flush(mockStats);
    });
  });

  describe('getDashboardActivity', () => {
    it('should GET /admin/dashboard/activity', () => {
      const mockActivity = [
        { type: 'article', description: 'New article created', timestamp: '2026-02-10T10:00:00Z' },
      ];

      service.getDashboardActivity().subscribe((activity) => {
        expect(activity).toEqual(mockActivity);
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/dashboard/activity`);
      expect(req.request.method).toBe('GET');
      req.flush(mockActivity);
    });
  });

  // ==================== ARTICLES ====================

  describe('getArticles', () => {
    it('should GET /admin/articles with default page and size', () => {
      const mockPage: PageResponse<AdminArticle> = {
        content: [],
        totalPages: 0,
        totalElements: 0,
        page: 0,
        size: 10,
        first: true,
        last: true,
      };

      service.getArticles().subscribe((response) => {
        expect(response).toEqual(mockPage);
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/articles?page=0&size=10`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('10');
      req.flush(mockPage);
    });

    it('should include status query param when provided', () => {
      service.getArticles(1, 5, 'PUBLISHED').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/articles?page=1&size=5&status=PUBLISHED`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('status')).toBe('PUBLISHED');
      req.flush({ content: [], totalPages: 0, totalElements: 0, page: 1, size: 5, first: false, last: true });
    });

    it('should not include status param when undefined', () => {
      service.getArticles(0, 10).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/articles?page=0&size=10`);
      expect(req.request.params.has('status')).toBeFalse();
      req.flush({ content: [], totalPages: 0, totalElements: 0, page: 0, size: 10, first: true, last: true });
    });
  });

  describe('createArticle', () => {
    it('should POST /admin/articles with body', () => {
      const articleData = { title: 'Test', content: 'Body' };
      const mockResponse: AdminArticle = {
        id: '1', slug: 'test', title: 'Test', status: 'DRAFT',
        viewCount: 0, likeCount: 0, createdAt: '2026-02-10', updatedAt: '2026-02-10',
      };

      service.createArticle(articleData).subscribe((article) => {
        expect(article.id).toBe('1');
        expect(article.title).toBe('Test');
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/articles`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(articleData);
      req.flush(mockResponse);
    });
  });

  describe('updateArticle', () => {
    it('should PUT /admin/articles/:id with body', () => {
      const updateData = { title: 'Updated' };

      service.updateArticle('abc-123', updateData).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/articles/abc-123`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateData);
      req.flush({});
    });
  });

  describe('deleteArticle', () => {
    it('should DELETE /admin/articles/:id', () => {
      service.deleteArticle('abc-123').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/articles/abc-123`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('publishArticle', () => {
    it('should PATCH /admin/articles/:id/publish', () => {
      service.publishArticle('abc-123').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/articles/abc-123/publish`);
      expect(req.request.method).toBe('PATCH');
      req.flush({});
    });
  });

  describe('unpublishArticle', () => {
    it('should PATCH /admin/articles/:id/unpublish', () => {
      service.unpublishArticle('abc-123').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/articles/abc-123/unpublish`);
      expect(req.request.method).toBe('PATCH');
      req.flush({});
    });
  });

  // ==================== COMMENTS ====================

  describe('getComments', () => {
    it('should GET /admin/comments with default params', () => {
      service.getComments().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/comments?page=0&size=20`);
      expect(req.request.method).toBe('GET');
      req.flush({ content: [], totalPages: 0, totalElements: 0, page: 0, size: 20, first: true, last: true });
    });

    it('should include status filter', () => {
      service.getComments(0, 20, 'PENDING').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/comments?page=0&size=20&status=PENDING`);
      expect(req.request.params.get('status')).toBe('PENDING');
      req.flush({ content: [], totalPages: 0, totalElements: 0, page: 0, size: 20, first: true, last: true });
    });
  });

  describe('deleteComment', () => {
    it('should DELETE /admin/comments/:id', () => {
      service.deleteComment('cmt-1').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/comments/cmt-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  // ==================== TAGS ====================

  describe('getTags', () => {
    it('should GET /admin/tags with default page and size', () => {
      service.getTags().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/tags?page=0&size=50`);
      expect(req.request.method).toBe('GET');
      req.flush({ content: [], totalPages: 0, totalElements: 0, page: 0, size: 50, first: true, last: true });
    });

    it('should GET /admin/tags with custom page and size', () => {
      service.getTags(2, 25).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/tags?page=2&size=25`);
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('size')).toBe('25');
      req.flush({ content: [], totalPages: 0, totalElements: 0, page: 2, size: 25, first: false, last: true });
    });
  });

  describe('createTag', () => {
    it('should POST /admin/tags', () => {
      const tagData = { name: 'Angular', description: 'Frontend framework', color: '#dd1b16' };

      service.createTag(tagData).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/tags`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(tagData);
      req.flush({ id: '1', name: 'Angular' });
    });
  });

  describe('deleteTag', () => {
    it('should DELETE /admin/tags/:id', () => {
      service.deleteTag('tag-1').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/tags/tag-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  // ==================== USERS ====================

  describe('getUsers', () => {
    it('should GET /admin/users with default params', () => {
      service.getUsers().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/users?page=0&size=20`);
      expect(req.request.method).toBe('GET');
      req.flush({ content: [], totalPages: 0, totalElements: 0, page: 0, size: 20, first: true, last: true });
    });
  });

  describe('deleteUser', () => {
    it('should DELETE /admin/users/:id', () => {
      service.deleteUser('user-1').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/users/user-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  // ==================== SETTINGS & CACHE ====================

  describe('getSettings', () => {
    it('should GET /admin/settings', () => {
      const mockSettings = { siteName: 'My Blog', locale: 'en' };

      service.getSettings().subscribe((settings) => {
        expect(settings).toEqual(mockSettings);
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/settings`);
      expect(req.request.method).toBe('GET');
      req.flush(mockSettings);
    });
  });

  describe('updateSettings', () => {
    it('should PUT /admin/settings with body', () => {
      const settingsData = { siteName: 'Updated Blog' };

      service.updateSettings(settingsData).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/settings`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(settingsData);
      req.flush(settingsData);
    });
  });

  describe('getCacheStats', () => {
    it('should GET /admin/cache/stats', () => {
      const mockCache: CacheStats = { articlesCount: 100, tagsCount: 20, commentsCount: 10, searchCount: 5, feedCount: 3 };

      service.getCacheStats().subscribe((stats) => {
        expect(stats).toEqual(mockCache);
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/cache/stats`);
      expect(req.request.method).toBe('GET');
      req.flush(mockCache);
    });
  });

  describe('clearCache', () => {
    it('should DELETE /admin/cache', () => {
      service.clearCache().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/cache`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  // ==================== ANALYTICS ====================

  describe('getAnalyticsSummary', () => {
    it('should GET /admin/analytics/summary with default period', () => {
      service.getAnalyticsSummary().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/analytics/summary?period=30d`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('period')).toBe('30d');
      req.flush({});
    });

    it('should GET /admin/analytics/summary with custom period', () => {
      service.getAnalyticsSummary('7d').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/analytics/summary?period=7d`);
      expect(req.request.params.get('period')).toBe('7d');
      req.flush({});
    });
  });

  // ==================== NEWSLETTER ====================

  describe('getNewsletterStats', () => {
    it('should GET /admin/newsletter/stats', () => {
      const mockStats: NewsletterStats = { total: 100, active: 80, confirmed: 75, unsubscribed: 5 };

      service.getNewsletterStats().subscribe((stats) => {
        expect(stats).toEqual(mockStats);
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/newsletter/stats`);
      expect(req.request.method).toBe('GET');
      req.flush(mockStats);
    });
  });

  describe('getSubscribers', () => {
    it('should GET /admin/newsletter/subscribers with default params', () => {
      service.getSubscribers().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/newsletter/subscribers?page=0&size=20`);
      expect(req.request.method).toBe('GET');
      req.flush({ content: [], totalPages: 0, totalElements: 0, page: 0, size: 20, first: true, last: true });
    });
  });

  // ==================== CONTACT MESSAGES ====================

  describe('getContactMessages', () => {
    it('should GET /admin/contact/messages with default params', () => {
      service.getContactMessages().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/contact/messages?page=0&size=20`);
      expect(req.request.method).toBe('GET');
      req.flush({ content: [], totalPages: 0, totalElements: 0, page: 0, size: 20, first: true, last: true });
    });
  });

  describe('deleteMessage', () => {
    it('should DELETE /admin/contact/messages/:id', () => {
      service.deleteMessage('msg-1').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/contact/messages/msg-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  // ==================== ERROR HANDLING ====================

  describe('error handling', () => {
    it('should propagate HTTP errors', fakeAsync(() => {
      let errorResponse: any;

      service.getDashboardStats().subscribe({
        error: (err) => { errorResponse = err; },
      });

      // I-04: ApiService.get() now retries 2 times with increasing delay.
      // Flush all 3 attempts (initial + 2 retries) so the error propagates.
      const url = `${baseUrl}/admin/dashboard/stats`;

      // Initial attempt
      httpMock.expectOne(url).flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

      // 1st retry (after 1s delay)
      tick(1000);
      httpMock.expectOne(url).flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

      // 2nd retry (after 2s delay)
      tick(2000);
      httpMock.expectOne(url).flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

      expect(errorResponse.status).toBe(500);
    }));
  });
});
