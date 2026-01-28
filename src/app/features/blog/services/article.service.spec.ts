import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ArticleService } from './article.service';
import { I18nService } from '../../../core/services/i18n.service';
import { signal } from '@angular/core';

describe('ArticleService', () => {
  let service: ArticleService;
  let httpMock: HttpTestingController;
  let i18nServiceMock: jasmine.SpyObj<I18nService>;
  let langSignal = signal('en');

  const baseUrl = '/api/v1';

  beforeEach(() => {
    langSignal = signal('en');
    i18nServiceMock = jasmine.createSpyObj('I18nService', ['translate', 'setLanguage'], {
      language: langSignal,
    });

    TestBed.configureTestingModule({
      providers: [
        ArticleService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    });

    service = TestBed.inject(ArticleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getArticles', () => {
    it('should request articles with default pagination', () => {
      service.getArticles().subscribe((data) => {
        expect(data.content).toEqual([]);
      });

      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/articles` && r.params.get('page') === '0' && r.params.get('size') === '10'
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('locale')).toBe('en');
      req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0 });
    });

    it('should request articles with custom pagination', () => {
      service.getArticles(2, 20).subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/articles` && r.params.get('page') === '2' && r.params.get('size') === '20'
      );
      req.flush({ content: [], totalElements: 0, totalPages: 0, number: 2 });
    });

    it('should include date filters when provided', () => {
      service.getArticles(0, 10, '2025-01-01', '2025-12-31').subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/articles` && r.params.get('dateFrom') === '2025-01-01'
      );
      expect(req.request.params.get('dateTo')).toBe('2025-12-31');
      req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0 });
    });

    it('should map pt language to pt-br locale', () => {
      langSignal.set('pt');

      service.getArticles().subscribe();

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/articles`);
      expect(req.request.params.get('locale')).toBe('pt-br');
      req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0 });
    });
  });

  describe('getPopularArticles', () => {
    it('should request popular articles sorted by viewCount desc', () => {
      service.getPopularArticles(3).subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/articles` && r.params.get('sort') === 'viewCount,desc'
      );
      expect(req.request.params.get('size')).toBe('3');
      req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0 });
    });
  });

  describe('getArticleBySlug', () => {
    it('should request article by slug', () => {
      const slug = 'my-test-article';

      service.getArticleBySlug(slug).subscribe((data) => {
        expect(data.slug).toBe(slug);
      });

      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/articles/${slug}`
      );
      expect(req.request.method).toBe('GET');
      req.flush({ slug, title: 'Test', content: '' });
    });
  });

  describe('getArticlesByTag', () => {
    it('should request articles filtered by tag slug', () => {
      service.getArticlesByTag('java', 1, 5).subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/articles/tag/java` && r.params.get('page') === '1'
      );
      expect(req.request.params.get('size')).toBe('5');
      req.flush({ content: [], totalElements: 0, totalPages: 0, number: 1 });
    });
  });

  describe('getRelatedArticles', () => {
    it('should request related articles', () => {
      service.getRelatedArticles('my-article', 4).subscribe((data) => {
        expect(data).toEqual([]);
      });

      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/articles/my-article/related` && r.params.get('limit') === '4'
      );
      req.flush([]);
    });
  });

  describe('trackView', () => {
    it('should POST to track article view', () => {
      service.trackView('my-article').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/articles/my-article/view`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  describe('likeArticle', () => {
    it('should POST to like article and return count', () => {
      service.likeArticle('my-article').subscribe((result) => {
        expect(result.likeCount).toBe(42);
      });

      const req = httpMock.expectOne(`${baseUrl}/articles/my-article/like`);
      expect(req.request.method).toBe('POST');
      req.flush({ likeCount: 42 });
    });
  });
});
