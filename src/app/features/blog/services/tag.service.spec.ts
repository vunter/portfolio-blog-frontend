import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TagService } from './tag.service';
import { TagResponse } from '../../../models';

// AUD18-02: GET /tags returns PageResponse<TagResponse>; TagService is the
// single place that unwraps `.content` (reused by the admin article editor).
describe('TagService', () => {
  let service: TagService;
  let httpMock: HttpTestingController;

  const baseUrl = '/api/v1';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TagService,
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(TagService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getTags', () => {
    it('should unwrap the tag array from the paged response', () => {
      const mockTags = [
        { id: '1', name: 'Angular', slug: 'angular' },
        { id: '2', name: 'Spring', slug: 'spring' },
      ] as TagResponse[];

      service.getTags().subscribe((tags) => {
        expect(tags.length).toBe(2);
        expect(tags[0].slug).toBe('angular');
      });

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/tags`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('50');
      req.flush({ content: mockTags, totalElements: 2, totalPages: 1, page: 0, size: 50, first: true, last: true });
    });
  });

  describe('getTagBySlug', () => {
    it('should GET /tags/:slug', () => {
      const mockTag = { id: '1', name: 'Angular', slug: 'angular' } as TagResponse;

      service.getTagBySlug('angular').subscribe((tag) => {
        expect(tag).toEqual(mockTag);
      });

      const req = httpMock.expectOne(`${baseUrl}/tags/angular`);
      expect(req.request.method).toBe('GET');
      req.flush(mockTag);
    });
  });
});
