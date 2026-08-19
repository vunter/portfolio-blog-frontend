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
        publishedArticles: 20,
        draftArticles: 5,
        totalViews: 5000,
        totalComments: 120,
        pendingComments: 5,
        totalUsers: 10,
        totalTags: 8,
        newsletterSubscribers: 50,
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
        { id: '1', type: 'article', action: 'created', title: 'New article', description: 'New article created', createdAt: '2026-02-10T10:00:00Z' },
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
    // AUD18-04: backend returns a plain List<TagResponse> and ignores pagination
    it('should GET /admin/tags without pagination params and return an array', () => {
      const mockTags = [{ id: '1', name: 'Angular', slug: 'angular' }] as TagResponse[];

      service.getTags().subscribe((tags) => {
        expect(tags).toEqual(mockTags);
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/tags`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush(mockTags);
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

  // AUD19: granular cache invalidation
  describe('granular cache invalidation', () => {
    it('should DELETE /admin/cache/articles/{slug} with encoded slug', () => {
      service.clearArticleCache('my article').subscribe((r) => {
        expect(r.entriesRemoved).toBe(3);
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/cache/articles/my%20article`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ message: 'Article cache invalidated', slug: 'my article', entriesRemoved: 3 });
    });

    it('should DELETE /admin/cache/tags/{tagSlug}', () => {
      service.clearTagCache('java').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/cache/tags/java`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ message: 'ok', tagSlug: 'java', entriesRemoved: 1 });
    });

    it('should DELETE /admin/cache/comments without id and /admin/cache/comments/{id} with id', () => {
      service.clearCommentsCache().subscribe();
      httpMock.expectOne(`${baseUrl}/admin/cache/comments`).flush({ message: 'ok', entriesRemoved: 0 });

      service.clearCommentsCache('42').subscribe();
      const req = httpMock.expectOne(`${baseUrl}/admin/cache/comments/42`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ message: 'ok', articleId: '42', entriesRemoved: 2 });
    });

    it('should DELETE search and feeds caches', () => {
      service.clearSearchCache().subscribe();
      httpMock.expectOne(`${baseUrl}/admin/cache/search`).flush({ message: 'ok', entriesRemoved: 5 });

      service.clearFeedsCache().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/admin/cache/feeds`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ message: 'ok', entriesRemoved: 2 });
    });

    it('should DELETE all-articles and all-tags caches', () => {
      service.clearArticlesCache().subscribe();
      httpMock.expectOne(`${baseUrl}/admin/cache/articles`).flush({ message: 'ok', entriesRemoved: 10 });

      service.clearTagsCache().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/admin/cache/tags`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ message: 'ok', entriesRemoved: 4 });
    });
  });

  // AUD19-B: kept-endpoint consumers
  describe('kept-endpoint consumers', () => {
    // AUD19C-02: Snowflake string ids pass through untouched
    it('should GET /admin/comments/article/{articleId} with the raw string id', () => {
      service.getCommentsByArticle('9007199254740993').subscribe((comments) => {
        expect(comments).toEqual([]);
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/comments/article/9007199254740993`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should GET /admin/contact/messages/{id}', () => {
      service.getContactMessage('abc').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/contact/messages/abc`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 'abc' });
    });

    it('should GET /admin/users/{id} with the raw string id', () => {
      service.getUserById('7').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/users/7`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: '7' });
    });
  });

  // AUD19: audit drill-down
  describe('audit drill-down', () => {
    it('should GET /admin/audit/user/{userId} with pagination', () => {
      service.getAuditLogsByUser('7', 1, 50).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/audit/user/7?page=1&size=50`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should GET /admin/audit/entity/{type}/{id} with encoded id', () => {
      service.getAuditLogsByEntity('ARTICLE', 'slug/with/slash').subscribe();

      const req = httpMock.expectOne(
        `${baseUrl}/admin/audit/entity/ARTICLE/slug%2Fwith%2Fslash`
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  // ==================== ANALYTICS ====================

  describe('getAnalyticsSummary', () => {
    // AUD18-03: backend expects an int `days` param, not a `period` string
    it('should GET /admin/analytics/summary with default days', () => {
      service.getAnalyticsSummary().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/analytics/summary?days=30`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('days')).toBe('30');
      expect(req.request.params.has('period')).toBeFalse();
      req.flush({});
    });

    it('should GET /admin/analytics/summary with custom days', () => {
      service.getAnalyticsSummary(7).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/analytics/summary?days=7`);
      expect(req.request.params.get('days')).toBe('7');
      req.flush({});
    });
  });

  // ==================== NEWSLETTER ====================

  describe('getNewsletterStats', () => {
    // AUD18-01: backend stats are exactly {confirmed, pending, total}
    it('should GET /admin/newsletter/stats', () => {
      const mockStats: NewsletterStats = { confirmed: 75, pending: 20, total: 95 };

      service.getNewsletterStats().subscribe((stats) => {
        expect(stats).toEqual(mockStats);
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/newsletter/stats`);
      expect(req.request.method).toBe('GET');
      req.flush(mockStats);
    });
  });

  describe('deleteSubscribersBatch', () => {
    // AUD18-01: confirmed=true is required or the backend performs a dry-run
    it('should POST /admin/newsletter/subscribers/delete-batch with confirmed=true', () => {
      service.deleteSubscribersBatch(['1', '2']).subscribe((res) => {
        expect(res.count).toBe(2);
        expect(res.confirmed).toBeTrue();
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/newsletter/subscribers/delete-batch?confirmed=true`);
      expect(req.request.method).toBe('POST');
      expect(req.request.params.get('confirmed')).toBe('true');
      expect(req.request.body).toEqual({ ids: ['1', '2'] });
      req.flush({ message: 'Subscribers deleted', count: 2, confirmed: true });
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

  // ==================== EXPORT / IMPORT ====================

  // AUD19C-04 (A2): the backend takes @RequestBody String (JSON) + an
  // `overwrite` query param — never a multipart file, never double-stringified.
  describe('importBlog', () => {
    const fixture = { version: '1.0', articles: [{ title: 'Hello' }], exportedBy: 'admin', stats: {} };

    it('should POST the JSON body once with overwrite=false by default', () => {
      service.importBlog(fixture).subscribe((res) => {
        expect(res.articlesImported).toBe(1);
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/export/import?overwrite=false`);
      expect(req.request.method).toBe('POST');
      // The object goes through HttpClient serialization exactly once —
      // the body must still be the object, not a pre-stringified string.
      expect(req.request.body).toEqual(fixture);
      expect(typeof req.request.body).not.toBe('string');
      expect(req.request.params.get('overwrite')).toBe('false');
      req.flush({ message: 'Import completed', articlesImported: 1, articlesTotal: 1, tagsImported: 0, errors: [] });
    });

    it('should pass overwrite=true when requested', () => {
      service.importBlog(fixture, true).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/admin/export/import?overwrite=true`);
      expect(req.request.params.get('overwrite')).toBe('true');
      req.flush({ message: 'Import completed', articlesImported: 1, articlesTotal: 1, tagsImported: 0, errors: [] });
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
