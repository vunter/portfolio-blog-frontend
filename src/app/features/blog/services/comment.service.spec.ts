import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { CommentService } from './comment.service';

describe('CommentService', () => {
  let service: CommentService;
  let httpMock: HttpTestingController;

  const baseUrl = '/api/v1';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CommentService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CommentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getComments', () => {
    it('should return comments array from paged response', () => {
      const mockComments = [
        { id: 1, content: 'Great article!', authorName: 'John' },
        { id: 2, content: 'Thanks!', authorName: 'Jane' },
      ];

      service.getComments('test-article').subscribe((comments) => {
        expect(comments.length).toBe(2);
        expect(comments[0].content).toBe('Great article!');
      });

      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/articles/test-article/comments`
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('50');
      req.flush({ content: mockComments, totalElements: 2, totalPages: 1, page: 0, size: 20, first: true, last: true });
    });

    it('should return empty array when content is null', () => {
      service.getComments('empty-article').subscribe((comments) => {
        expect(comments).toEqual([]);
      });

      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/articles/empty-article/comments`
      );
      req.flush({ content: null, totalElements: 0, totalPages: 0, page: 0, size: 20, first: true, last: true });
    });
  });

  describe('getCommentsPaged', () => {
    it('should return full paged response', () => {
      service.getCommentsPaged('test-article', 1, 10).subscribe((response) => {
        expect(response.totalElements).toBe(25);
        expect(response.page).toBe(1);
      });

      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/articles/test-article/comments`
          && r.params.get('page') === '1'
          && r.params.get('size') === '10'
      );
      req.flush({ content: [], totalElements: 25, totalPages: 3, page: 1, size: 10, first: false, last: false });
    });
  });

  describe('getCommentCount', () => {
    it('should return comment count', () => {
      service.getCommentCount('test-article').subscribe((count) => {
        expect(count).toBe(42);
      });

      const req = httpMock.expectOne(`${baseUrl}/articles/test-article/comments/count`);
      expect(req.request.method).toBe('GET');
      req.flush(42);
    });
  });

  describe('createComment', () => {
    it('should POST comment and return created comment', () => {
      const request = { content: 'Nice post!', authorName: 'Reader' };

      service.createComment('test-article', request as any).subscribe((comment) => {
        expect(comment.content).toBe('Nice post!');
      });

      const req = httpMock.expectOne(`${baseUrl}/articles/test-article/comments`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush({ id: 1, content: 'Nice post!', authorName: 'Reader', status: 'PENDING' });
    });
  });
});
