import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { CommentListComponent } from './comment-list.component';
import { ApiService } from '../../../../core/services/api.service';
import { AdminApiService, AdminComment } from '../../services/admin-api.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { CommentResponse, PageResponse } from '../../../../models';

describe('CommentListComponent', () => {
  let component: CommentListComponent;
  let fixture: ComponentFixture<CommentListComponent>;
  let mockApiService: jasmine.SpyObj<ApiService>;
  let mockAdminApi: jasmine.SpyObj<AdminApiService>;
  let mockNotification: jasmine.SpyObj<NotificationService>;
  let mockConfirmDialog: jasmine.SpyObj<ConfirmDialogService>;

  const makeComment = (overrides: Partial<CommentResponse>): CommentResponse => ({
    id: '1',
    articleId: '42',
    articleSlug: 'some-article',
    articleTitle: 'Some Article',
    authorName: 'Alice',
    content: 'Nice post!',
    status: 'PENDING',
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
    ...overrides,
  } as CommentResponse);

  const pagedComments: CommentResponse[] = [
    makeComment({ id: '1', status: 'PENDING' }),
    makeComment({ id: '2', status: 'APPROVED', authorName: 'Bob' }),
  ];

  const mockPageResponse: PageResponse<CommentResponse> = {
    content: pagedComments,
    page: 0,
    size: 10,
    totalElements: 25,
    totalPages: 3,
    first: true,
    last: false,
  };

  // GET /admin/comments/article/{id} returns all statuses, unpaged (≤500)
  const articleComments = [
    makeComment({ id: '10', status: 'PENDING', authorName: 'Carol' }),
    makeComment({ id: '11', status: 'APPROVED', authorName: 'Dave' }),
    makeComment({ id: '12', status: 'REJECTED', authorName: 'Erin', content: 'Spammy stuff' }),
  ] as unknown as AdminComment[];

  beforeEach(async () => {
    mockApiService = jasmine.createSpyObj('ApiService', ['get', 'post', 'put', 'delete']);
    mockAdminApi = jasmine.createSpyObj('AdminApiService', ['getCommentsByArticle', 'bulkCommentAction']);
    mockNotification = jasmine.createSpyObj('NotificationService', ['success', 'error', 'warning', 'info', 'successWithUndo']);
    mockConfirmDialog = jasmine.createSpyObj('ConfirmDialogService', ['confirm']);

    mockApiService.get.and.returnValue(of(mockPageResponse));
    mockAdminApi.getCommentsByArticle.and.returnValue(of(articleComments));
    mockConfirmDialog.confirm.and.returnValue(Promise.resolve(true));

    const mockI18n = {
      t: (key: string) => key,
      language: signal('en'),
    };

    await TestBed.configureTestingModule({
      imports: [CommentListComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: ApiService, useValue: mockApiService },
        { provide: AdminApiService, useValue: mockAdminApi },
        { provide: I18nService, useValue: mockI18n },
        { provide: NotificationService, useValue: mockNotification },
        { provide: ConfirmDialogService, useValue: mockConfirmDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentListComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // The API caps a bulk payload at 100 ids while the per-article view can select
  // up to 500, so the component has to split the request.
  it('should send bulk moderation in batches of 100', fakeAsync(() => {
    mockAdminApi.bulkCommentAction.and.returnValue(of(undefined));
    fixture.detectChanges();
    tick();

    const ids = Array.from({ length: 150 }, (_, i) => String(i + 1));
    component.selectedIds.set(new Set(ids));

    component.bulkAction('approve');
    tick();

    expect(mockAdminApi.bulkCommentAction).toHaveBeenCalledTimes(2);
    const [firstAction, firstBatch] = mockAdminApi.bulkCommentAction.calls.argsFor(0);
    const [, secondBatch] = mockAdminApi.bulkCommentAction.calls.argsFor(1);
    expect(firstAction).toBe('approve');
    expect(firstBatch.length).toBe(100);
    expect(secondBatch.length).toBe(50);
    expect([...firstBatch, ...secondBatch]).toEqual(ids);
    expect(mockNotification.success).toHaveBeenCalled();
    expect(component.selectedIds().size).toBe(0);
  }));

  it('should send a single bulk request when the selection fits in one batch', fakeAsync(() => {
    mockAdminApi.bulkCommentAction.and.returnValue(of(undefined));
    fixture.detectChanges();
    tick();

    component.selectedIds.set(new Set(['1', '2', '3']));
    component.bulkAction('reject');
    tick();

    expect(mockAdminApi.bulkCommentAction).toHaveBeenCalledTimes(1);
    expect(mockAdminApi.bulkCommentAction.calls.argsFor(0)[1]).toEqual(['1', '2', '3']);
  }));

  it('should load paged comments on init (normal mode)', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(mockApiService.get).toHaveBeenCalledWith('/admin/comments', jasmine.objectContaining({ page: '0' }));
    expect(mockAdminApi.getCommentsByArticle).not.toHaveBeenCalled();
    expect(component.comments().length).toBe(2);
    expect(component.totalPages()).toBe(3);
  }));

  describe('article filter mode', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick();
      mockApiService.get.calls.reset();
    }));

    it('should fetch via getCommentsByArticle when the article filter is applied', fakeAsync(() => {
      component.articleFilterInput = '42';
      component.applyArticleFilter();
      tick();

      // AUD19C-02: the id stays a string end-to-end (Snowflake > 2^53)
      expect(component.articleFilter()).toBe('42');
      expect(mockAdminApi.getCommentsByArticle).toHaveBeenCalledWith('42');
      // No server-side paged fetch in article mode
      expect(mockApiService.get).not.toHaveBeenCalled();
      expect(component.comments().length).toBe(3);
    }));

    it('should keep Snowflake-sized ids intact (no Number round-trip)', fakeAsync(() => {
      component.articleFilterInput = '9007199254740993';
      component.applyArticleFilter();
      tick();

      expect(mockAdminApi.getCommentsByArticle).toHaveBeenCalledWith('9007199254740993');
    }));

    it('should hide server pagination in article mode (single fetch)', fakeAsync(() => {
      component.articleFilterInput = '42';
      component.applyArticleFilter();
      tick();

      expect(component.totalPages()).toBe(1);
      expect(component.totalElements()).toBe(3);
    }));

    it('should compose the status filter client-side in article mode', fakeAsync(() => {
      component.articleFilterInput = '42';
      component.statusFilter = 'APPROVED';
      component.applyArticleFilter();
      tick();

      expect(mockAdminApi.getCommentsByArticle).toHaveBeenCalledWith('42');
      expect(component.comments().length).toBe(1);
      expect(component.comments()[0].status).toBe('APPROVED');
      // Status must not be sent server-side — the article endpoint takes no params
      expect(mockApiService.get).not.toHaveBeenCalled();
    }));

    it('should compose the search query client-side in article mode', fakeAsync(() => {
      component.articleFilterInput = '42';
      component.applyArticleFilter();
      tick();

      component.searchQuery.set('spammy');
      component.loadComments();
      tick();

      expect(component.comments().length).toBe(1);
      expect(component.comments()[0].id).toBe('12');
    }));

    // AUD19C-05: invalid input now notifies instead of silently no-oping
    it('should reject invalid article IDs with a notification', () => {
      component.articleFilterInput = 'abc';
      component.applyArticleFilter();
      expect(component.articleFilter()).toBeNull();
      expect(mockNotification.error).toHaveBeenCalledWith('dev.comments.articleFilterInvalid');

      mockNotification.error.calls.reset();
      component.articleFilterInput = '-3';
      component.applyArticleFilter();
      expect(component.articleFilter()).toBeNull();
      expect(mockNotification.error).toHaveBeenCalledWith('dev.comments.articleFilterInvalid');

      mockNotification.error.calls.reset();
      component.articleFilterInput = '   ';
      component.applyArticleFilter();
      expect(component.articleFilter()).toBeNull();
      expect(mockNotification.error).toHaveBeenCalledWith('dev.comments.articleFilterInvalid');

      expect(mockAdminApi.getCommentsByArticle).not.toHaveBeenCalled();
    });

    it('should enter article mode when drilling down from a comment row', fakeAsync(() => {
      component.filterByArticle(pagedComments[0]);
      tick();

      expect(component.articleFilter()).toBe('42');
      expect(component.articleFilterInput).toBe('42');
      expect(mockAdminApi.getCommentsByArticle).toHaveBeenCalledWith('42');
    }));

    it('should render the active-filter chip in article mode', fakeAsync(() => {
      component.articleFilterInput = '42';
      component.applyArticleFilter();
      tick();
      fixture.detectChanges();

      const chip = fixture.nativeElement.querySelector('.filter-chip');
      expect(chip).toBeTruthy();
      expect(chip.textContent).toContain('#42');
    }));

    it('should clear the filter and return to paged mode from the chip', fakeAsync(() => {
      component.articleFilterInput = '42';
      component.applyArticleFilter();
      tick();
      mockAdminApi.getCommentsByArticle.calls.reset();

      component.clearArticleFilter();
      tick();

      expect(component.articleFilter()).toBeNull();
      expect(component.articleFilterInput).toBe('');
      expect(component.currentPage()).toBe(0);
      expect(mockApiService.get).toHaveBeenCalledWith('/admin/comments', jasmine.objectContaining({ page: '0' }));
      expect(mockAdminApi.getCommentsByArticle).not.toHaveBeenCalled();
      expect(component.totalPages()).toBe(3);
    }));

    // AUD19C-05: SPAM is a real backend status and needs a label + filter option
    it('should label SPAM comments and offer SPAM in the status filter', () => {
      expect(component.getStatusLabel('SPAM')).toBe('dev.comments.spam');

      fixture.detectChanges();
      const options = Array.from(
        fixture.nativeElement.querySelectorAll('.filters select option')
      ).map((o) => (o as HTMLOptionElement).value);
      expect(options).toContain('SPAM');
    });

    it('should set error state when the article fetch fails', fakeAsync(() => {
      mockAdminApi.getCommentsByArticle.and.returnValue(throwError(() => new Error('boom')));

      component.articleFilterInput = '42';
      component.applyArticleFilter();
      tick();

      expect(component.error()).toBeTrue();
      expect(mockNotification.error).toHaveBeenCalled();
    }));
  });
});
