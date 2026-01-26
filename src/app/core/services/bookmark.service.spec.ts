// TODO F-374: Decouple from constructor side effect when F-330 is addressed
import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { BookmarkService } from './bookmark.service';

describe('BookmarkService', () => {
  let service: BookmarkService;
  let httpMock: HttpTestingController;

  const baseUrl = '/api/v1/bookmarks';

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        BookmarkService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(BookmarkService);
    httpMock = TestBed.inject(HttpTestingController);

    // Flush the syncFromBackend GET that fires in the constructor
    const syncReq = httpMock.match(
      (req) => req.method === 'GET' && req.url === baseUrl
    );
    syncReq.forEach((req) => req.flush({ content: [] }));
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with empty bookmarks', () => {
    expect(service.count()).toBe(0);
    expect(service.bookmarks().size).toBe(0);
  });

  describe('isBookmarked', () => {
    it('should return false for an unbookmarked slug', () => {
      expect(service.isBookmarked('my-article')).toBeFalse();
    });

    it('should return true after toggling a bookmark on', () => {
      service.toggle('my-article');
      const req = httpMock.expectOne(`${baseUrl}/my-article`);
      req.flush(null);

      expect(service.isBookmarked('my-article')).toBeTrue();
    });
  });

  describe('toggle', () => {
    it('should add a bookmark and send POST', () => {
      const result = service.toggle('new-article');

      expect(result).toBeTrue();
      expect(service.isBookmarked('new-article')).toBeTrue();
      expect(service.count()).toBe(1);

      const req = httpMock.expectOne(`${baseUrl}/new-article`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.has('X-Visitor-Id')).toBeTrue();
      req.flush(null);
    });

    it('should remove a bookmark and send DELETE', () => {
      // First add
      service.toggle('existing-article');
      httpMock.expectOne(`${baseUrl}/existing-article`).flush(null);

      // Then remove
      const result = service.toggle('existing-article');

      expect(result).toBeFalse();
      expect(service.isBookmarked('existing-article')).toBeFalse();
      expect(service.count()).toBe(0);

      const req = httpMock.expectOne(`${baseUrl}/existing-article`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should revert on POST error (add failed)', () => {
      service.toggle('fail-article');
      expect(service.isBookmarked('fail-article')).toBeTrue();

      const req = httpMock.expectOne(`${baseUrl}/fail-article`);
      req.error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });

      expect(service.isBookmarked('fail-article')).toBeFalse();
    });

    it('should revert on DELETE error (remove failed)', () => {
      // Add first
      service.toggle('revert-article');
      httpMock.expectOne(`${baseUrl}/revert-article`).flush(null);
      expect(service.isBookmarked('revert-article')).toBeTrue();

      // Remove — will fail
      service.toggle('revert-article');
      expect(service.isBookmarked('revert-article')).toBeFalse();

      const req = httpMock.expectOne(`${baseUrl}/revert-article`);
      req.error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });

      expect(service.isBookmarked('revert-article')).toBeTrue();
    });

    it('should include X-Visitor-Id header in requests', () => {
      service.toggle('header-test');

      const req = httpMock.expectOne(`${baseUrl}/header-test`);
      expect(req.request.headers.has('X-Visitor-Id')).toBeTrue();
      expect(req.request.headers.get('X-Visitor-Id')).toBeTruthy();
      req.flush(null);
    });
  });

  describe('persistence', () => {
    it('should persist bookmarks to localStorage', () => {
      service.toggle('persisted-article');
      httpMock.expectOne(`${baseUrl}/persisted-article`).flush(null);

      const stored = localStorage.getItem('bookmarked-articles');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed).toContain('persisted-article');
    });

    it('should create and persist a visitor ID', () => {
      service.toggle('visitor-test');
      httpMock.expectOne(`${baseUrl}/visitor-test`).flush(null);

      const visitorId = localStorage.getItem('visitor-id');
      expect(visitorId).toBeTruthy();
    });
  });

  describe('count', () => {
    it('should reflect the number of bookmarks', () => {
      expect(service.count()).toBe(0);

      service.toggle('a1');
      httpMock.expectOne(`${baseUrl}/a1`).flush(null);
      expect(service.count()).toBe(1);

      service.toggle('a2');
      httpMock.expectOne(`${baseUrl}/a2`).flush(null);
      expect(service.count()).toBe(2);

      service.toggle('a1');
      httpMock.expectOne(`${baseUrl}/a1`).flush(null);
      expect(service.count()).toBe(1);
    });
  });
});
