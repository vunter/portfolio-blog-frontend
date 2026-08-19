import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject, of, throwError } from 'rxjs';
import { SettingsComponent } from './settings.component';
import { AdminApiService, CacheInvalidationResult } from '../../services/admin-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { DownloadService } from '../../../../core/services/download.service';
import { ApiService } from '../../../../core/services/api.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';

// AUD19: spec for the granular cache invalidation panel
describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let mockAdminApi: jasmine.SpyObj<AdminApiService>;
  let mockNotification: jasmine.SpyObj<NotificationService>;
  let mockConfirm: jasmine.SpyObj<ConfirmDialogService>;
  let mockDownload: jasmine.SpyObj<DownloadService>;
  let i18nSpy: { t: jasmine.Spy };

  const invalidationResult = (entriesRemoved: number): CacheInvalidationResult => ({
    message: 'cache.cleared',
    entriesRemoved,
  });

  beforeEach(async () => {
    mockAdminApi = jasmine.createSpyObj('AdminApiService', [
      'getSettings',
      'updateSettings',
      'getCacheStats',
      'clearCache',
      'clearArticlesCache',
      'clearArticleCache',
      'clearTagsCache',
      'clearTagCache',
      'clearCommentsCache',
      'clearSearchCache',
      'clearFeedsCache',
      'exportBlogJson',
      'exportArticlesMarkdown',
      'importBlog',
    ]);
    mockNotification = jasmine.createSpyObj('NotificationService', ['success', 'error', 'warning', 'info']);
    mockConfirm = jasmine.createSpyObj('ConfirmDialogService', ['confirm']);
    mockDownload = jasmine.createSpyObj('DownloadService', ['downloadBlob']);

    mockAdminApi.getSettings.and.returnValue(of({}));
    mockAdminApi.getCacheStats.and.returnValue(
      of({ articlesCount: 3, tagsCount: 2, commentsCount: 0, searchCount: 0, feedCount: 0 })
    );

    i18nSpy = {
      t: jasmine.createSpy('t').and.callFake((key: string) => key),
    };
    const mockI18n = {
      t: i18nSpy.t,
      language: signal('en'),
      supportedLanguages: signal([]),
      setLanguage: () => {},
    };

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: AdminApiService, useValue: mockAdminApi },
        { provide: NotificationService, useValue: mockNotification },
        { provide: ConfirmDialogService, useValue: mockConfirm },
        { provide: DownloadService, useValue: mockDownload },
        { provide: ApiService, useValue: jasmine.createSpyObj('ApiService', ['get', 'post', 'put', 'delete']) },
        { provide: I18nService, useValue: mockI18n },
      ],
    })
      // The email-templates and translation sub-components are out of scope here:
      // render the page without them so their API calls don't pollute the spec.
      .overrideComponent(SettingsComponent, {
        set: {
          imports: [ReactiveFormsModule, FormsModule, SkeletonComponent],
          schemas: [CUSTOM_ELEMENTS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
  });

  it('should create and load settings + cache stats', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(mockAdminApi.getSettings).toHaveBeenCalled();
    expect(mockAdminApi.getCacheStats).toHaveBeenCalled();
    expect(component.cacheStats().entries).toBe(5);
  });

  describe('granular invalidation', () => {
    it('tracks a per-action busy state while the call is in flight', () => {
      const pending = new Subject<CacheInvalidationResult>();
      mockAdminApi.clearArticlesCache.and.returnValue(pending.asObservable());
      fixture.detectChanges();

      component.clearArticlesCache();
      fixture.detectChanges();

      expect(component.isGranularBusy('articles')).toBeTrue();
      expect(component.isGranularBusy('tags')).toBeFalse();
      const articlesBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[data-action="articles"]');
      const tagsBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[data-action="tags"]');
      expect(articlesBtn.disabled).toBeTrue();
      expect(tagsBtn.disabled).toBeFalse();

      pending.next(invalidationResult(7));
      pending.complete();
      fixture.detectChanges();

      expect(component.isGranularBusy('articles')).toBeFalse();
      expect(articlesBtn.disabled).toBeFalse();
    });

    it('surfaces entriesRemoved in a toast and the inline result note', () => {
      mockAdminApi.clearSearchCache.and.returnValue(of(invalidationResult(42)));
      fixture.detectChanges();

      component.clearSearchCache();
      fixture.detectChanges();

      expect(mockNotification.success).toHaveBeenCalled();
      expect(i18nSpy.t).toHaveBeenCalledWith('admin.settings.granularCache.success', { count: 42 });
      const note: HTMLElement | null = fixture.nativeElement.querySelector('.granular-result__count');
      expect(note?.textContent).toContain('42');
      // Invalidation refreshes the stats display
      expect(mockAdminApi.getCacheStats).toHaveBeenCalledTimes(2);
    });

    it('sends the trimmed slug on targeted article invalidation', () => {
      mockAdminApi.clearArticleCache.and.returnValue(of(invalidationResult(1)));
      fixture.detectChanges();

      component.articleSlug = '  my-article  ';
      component.clearArticleBySlug();

      expect(mockAdminApi.clearArticleCache).toHaveBeenCalledWith('my-article');
      expect(mockNotification.success).toHaveBeenCalled();
    });

    it('sends the trimmed tag slug and article id on the other targeted rows', () => {
      mockAdminApi.clearTagCache.and.returnValue(of(invalidationResult(2)));
      mockAdminApi.clearCommentsCache.and.returnValue(of(invalidationResult(3)));
      fixture.detectChanges();

      component.tagSlug = ' angular ';
      component.clearTagBySlug();
      expect(mockAdminApi.clearTagCache).toHaveBeenCalledWith('angular');

      component.commentsArticleId = ' 12345 ';
      component.clearCommentsByArticleId();
      expect(mockAdminApi.clearCommentsCache).toHaveBeenCalledWith('12345');
    });

    it('rejects empty targeted input without calling the API', () => {
      fixture.detectChanges();

      component.articleSlug = '   ';
      component.clearArticleBySlug();

      expect(mockAdminApi.clearArticleCache).not.toHaveBeenCalled();
      expect(mockNotification.error).toHaveBeenCalled();
      expect(i18nSpy.t).toHaveBeenCalledWith('admin.settings.granularCache.valueRequired');
    });

    it('clears the busy state and notifies on failure (no stuck spinner)', () => {
      mockAdminApi.clearFeedsCache.and.returnValue(throwError(() => new Error('boom')));
      fixture.detectChanges();

      component.clearFeedsCache();
      fixture.detectChanges();

      expect(component.isGranularBusy('feeds')).toBeFalse();
      expect(mockNotification.error).toHaveBeenCalled();
      expect(i18nSpy.t).toHaveBeenCalledWith('admin.settings.granularCache.error');
      const feedsBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[data-action="feeds"]');
      expect(feedsBtn.disabled).toBeFalse();
    });

    it('clears all comments without an article id via the panel button', () => {
      mockAdminApi.clearCommentsCache.and.returnValue(of(invalidationResult(9)));
      fixture.detectChanges();

      component.clearAllCommentsCache();

      expect(mockAdminApi.clearCommentsCache).toHaveBeenCalledWith();
    });
  });

  // AUD19C-04 (A2): import posts JSON + overwrite param; export naming fixed
  describe('export/import', () => {
    const exportFixture = {
      version: '1.0',
      exportedAt: '2026-08-18T10:00:00Z',
      exportedBy: 'admin@example.com',
      stats: { articles: 1, tags: 0 },
      articles: [{ title: 'Hello world', content: 'Body' }],
    };

    const importResult = {
      message: 'Import completed', articlesImported: 1, articlesTotal: 1, tagsImported: 0, errors: [] as string[],
    };

    function makeFileEvent(content: string): Event {
      const file = new File([content], 'blog-export.json', { type: 'application/json' });
      return { target: { files: [file], value: '' } } as unknown as Event;
    }

    it('accepts an export-shaped fixture (with exportedBy/stats) and posts the object + overwrite flag', async () => {
      mockConfirm.confirm.and.returnValue(Promise.resolve(true));
      mockAdminApi.importBlog.and.returnValue(of(importResult));
      fixture.detectChanges();

      component.importOverwrite = true;
      await component.onImportFileSelected(makeFileEvent(JSON.stringify(exportFixture)));

      expect(mockAdminApi.importBlog).toHaveBeenCalledTimes(1);
      const [body, overwrite] = mockAdminApi.importBlog.calls.mostRecent().args;
      expect(overwrite).toBeTrue();
      // The sanitized OBJECT is passed — never pre-stringified, never re-wrapped in a File
      expect(typeof body).toBe('object');
      expect((body as Record<string, unknown>)['exportedBy']).toBe('admin@example.com');
      expect((body as Record<string, unknown>)['stats']).toEqual(exportFixture.stats);
      expect(mockNotification.success).toHaveBeenCalled();
      // Surfaces the imported count in the toast
      expect(i18nSpy.t).toHaveBeenCalledWith('admin.settings.importSuccessDetail', { imported: 1, total: 1 });
    });

    it('defaults to overwrite=false', async () => {
      mockConfirm.confirm.and.returnValue(Promise.resolve(true));
      mockAdminApi.importBlog.and.returnValue(of(importResult));
      fixture.detectChanges();

      await component.onImportFileSelected(makeFileEvent(JSON.stringify(exportFixture)));

      const [, overwrite] = mockAdminApi.importBlog.calls.mostRecent().args;
      expect(overwrite).toBeFalse();
    });

    it('rejects unknown top-level keys without calling the API', async () => {
      fixture.detectChanges();

      await component.onImportFileSelected(makeFileEvent(JSON.stringify({ nonsense: true })));

      expect(mockAdminApi.importBlog).not.toHaveBeenCalled();
      expect(mockNotification.error).toHaveBeenCalled();
    });

    it('names the markdown export download .json (the endpoint returns JSON, not a zip)', () => {
      mockAdminApi.exportArticlesMarkdown.and.returnValue(of(new Blob(['{}'], { type: 'application/json' })));
      fixture.detectChanges();

      component.exportMarkdown();

      const [, filename] = mockDownload.downloadBlob.calls.mostRecent().args;
      expect(filename).toMatch(/^articles-markdown-\d{4}-\d{2}-\d{2}\.json$/);
    });
  });

  describe('clear all (global)', () => {
    it('keeps the confirmed destructive clear-all flow', async () => {
      mockConfirm.confirm.and.returnValue(Promise.resolve(true));
      mockAdminApi.clearCache.and.returnValue(of(void 0));
      fixture.detectChanges();

      await component.clearCache();

      expect(mockConfirm.confirm).toHaveBeenCalled();
      expect(mockAdminApi.clearCache).toHaveBeenCalled();
    });

    it('marks the clear-all button as the danger option', () => {
      fixture.detectChanges();
      const dangerBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector('.btn-danger');
      expect(dangerBtn).toBeTruthy();
    });
  });
});
