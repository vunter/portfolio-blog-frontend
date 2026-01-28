import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ArticleListComponent } from './article-list.component';
import { ApiService } from '../../../../core/services/api.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { ArticleResponse, PageResponse } from '../../../../models';

describe('ArticleListComponent', () => {
  let component: ArticleListComponent;
  let fixture: ComponentFixture<ArticleListComponent>;
  let mockApiService: jasmine.SpyObj<ApiService>;
  let mockNotification: jasmine.SpyObj<NotificationService>;
  let mockConfirmDialog: jasmine.SpyObj<ConfirmDialogService>;

  const mockArticles: ArticleResponse[] = [
    {
      id: '1', slug: 'first-article', title: 'First Article', status: 'PUBLISHED',
      content: '# Hello', summary: 'Summary', viewCount: 100, likeCount: 10,
      commentCount: 5, tags: [], publishedAt: '2026-02-01T10:00:00Z',
      createdAt: '2026-01-20T10:00:00Z', updatedAt: '2026-02-01T10:00:00Z',
    } as any,
    {
      id: '2', slug: 'second-article', title: 'Second Article', status: 'DRAFT',
      content: '# Draft', summary: 'Draft summary', viewCount: 0, likeCount: 0,
      commentCount: 0, tags: [], createdAt: '2026-02-05T10:00:00Z',
      updatedAt: '2026-02-05T10:00:00Z',
    } as any,
    {
      id: '3', slug: 'third-article', title: 'Third Article', status: 'ARCHIVED',
      content: '# Archived', summary: 'Old', viewCount: 50, likeCount: 3,
      commentCount: 2, tags: [], publishedAt: '2025-06-01T10:00:00Z',
      createdAt: '2025-05-01T10:00:00Z', updatedAt: '2025-06-01T10:00:00Z',
    } as any,
  ];

  const mockPageResponse: PageResponse<ArticleResponse> = {
    content: mockArticles,
    totalPages: 3,
    totalElements: 25,
    page: 0,
    size: 10,
    first: true,
    last: false,
  };

  beforeEach(async () => {
    mockApiService = jasmine.createSpyObj('ApiService', ['get', 'post', 'put', 'patch', 'delete']);
    mockNotification = jasmine.createSpyObj('NotificationService', ['success', 'error', 'warning', 'info']);
    mockConfirmDialog = jasmine.createSpyObj('ConfirmDialogService', ['confirm']);

    mockApiService.get.and.returnValue(of(mockPageResponse));
    mockConfirmDialog.confirm.and.returnValue(Promise.resolve(true));
    mockApiService.patch.and.returnValue(of({}));
    mockApiService.delete.and.returnValue(of(undefined));

    const mockI18n = {
      t: (key: string) => key,
      language: signal('en'),
    };

    await TestBed.configureTestingModule({
      imports: [ArticleListComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: mockApiService },
        { provide: I18nService, useValue: mockI18n },
        { provide: NotificationService, useValue: mockNotification },
        { provide: ConfirmDialogService, useValue: mockConfirmDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ArticleListComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load articles on init', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(mockApiService.get).toHaveBeenCalled();
    expect(component.articles().length).toBe(3);
    expect(component.loading()).toBeFalse();
  }));

  it('should set pagination signals from response', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(component.totalPages()).toBe(3);
    expect(component.totalElements()).toBe(25);
    expect(component.currentPage()).toBe(0);
    expect(component.pageSize()).toBe(10);
  }));

  it('should render article rows in table', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
  }));

  it('should render article titles', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const titles = fixture.nativeElement.querySelectorAll('.article-title');
    expect(titles.length).toBe(3);
    expect(titles[0].textContent.trim()).toContain('First Article');
  }));

  it('should render status badges', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const badges = fixture.nativeElement.querySelectorAll('.status-badge');
    expect(badges.length).toBe(3);
  }));

  it('should change page and reload articles', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    mockApiService.get.calls.reset();

    component.onPageChange(2);
    tick();

    expect(component.currentPage()).toBe(2);
    expect(mockApiService.get).toHaveBeenCalled();
    const callArgs = mockApiService.get.calls.mostRecent().args;
    expect(callArgs[0]).toBe('/admin/articles');
    expect((callArgs[1] as any)['page']).toBe('2');
  }));

  it('should filter by status and reload', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    mockApiService.get.calls.reset();

    component.statusFilter = 'PUBLISHED';
    component.loadArticles();
    tick();

    const callArgs = mockApiService.get.calls.mostRecent().args;
    expect((callArgs[1] as any)['status']).toBe('PUBLISHED');
  }));

  it('should debounce search input', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    mockApiService.get.calls.reset();

    component.searchTerm = 'angular';
    component.onSearch();

    // Should not have called immediately
    expect(mockApiService.get).not.toHaveBeenCalled();

    tick(300); // debounce time

    expect(mockApiService.get).toHaveBeenCalled();
    expect(component.currentPage()).toBe(0); // resets to first page
  }));

  it('should set error state when loading fails', fakeAsync(() => {
    mockApiService.get.and.returnValue(throwError(() => new Error('Network error')));

    fixture.detectChanges();
    tick();

    expect(component.error()).toBeTrue();
    expect(component.loading()).toBeFalse();
    expect(mockNotification.error).toHaveBeenCalled();
  }));

  it('should delete article after confirmation', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    mockApiService.get.calls.reset();

    component.deleteArticle(mockArticles[0]);
    tick();

    expect(mockConfirmDialog.confirm).toHaveBeenCalled();
    expect(mockApiService.delete).toHaveBeenCalledWith('/admin/articles/1');
    expect(mockNotification.success).toHaveBeenCalled();
  }));

  it('should not delete article when confirmation is cancelled', fakeAsync(() => {
    mockConfirmDialog.confirm.and.returnValue(Promise.resolve(false));

    fixture.detectChanges();
    tick();

    component.deleteArticle(mockArticles[0]);
    tick();

    expect(mockApiService.delete).not.toHaveBeenCalled();
  }));

  it('should return correct status labels', () => {
    expect(component.getStatusLabel('PUBLISHED')).toBe('admin.articles.published');
    expect(component.getStatusLabel('DRAFT')).toBe('admin.articles.draft');
    expect(component.getStatusLabel('ARCHIVED')).toBe('admin.articles.archived');
    expect(component.getStatusLabel('UNKNOWN')).toBe('UNKNOWN');
  });

  it('should open and close preview modal', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(component.previewingArticle()).toBeNull();

    component.previewArticle(mockArticles[0]);
    expect(component.previewingArticle()).toEqual(mockArticles[0]);

    component.closePreview();
    expect(component.previewingArticle()).toBeNull();
  }));

  it('should show empty message when no articles', fakeAsync(() => {
    mockApiService.get.and.returnValue(of({
      content: [],
      totalPages: 0,
      totalElements: 0,
      page: 0,
      size: 10,
      first: true,
      last: true,
    }));

    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const emptyMsg = fixture.nativeElement.querySelector('.empty-message');
    expect(emptyMsg).toBeTruthy();
  }));
});
