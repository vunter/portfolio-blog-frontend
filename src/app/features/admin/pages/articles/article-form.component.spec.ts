import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ArticleFormComponent } from './article-form.component';
import { ApiService } from '../../../../core/services/api.service';
import { AdminApiService } from '../../services/admin-api.service';
import { TagService } from '../../../blog/services/tag.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { MonacoLoaderService } from '../../../../core/services/monaco-loader.service';
import { ImageOptimizerService } from '../../../../core/services/image-optimizer.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ArticleRequest, ArticleResponse } from '../../../../models';

// AUD19C-07 (A4-FE): scheduledAt round-trip — loadArticle/onVersionRestored
// populate the schedule control so quickSave of a SCHEDULED article re-sends
// the timestamp instead of silently dropping it.
//
// Note: the component class is exercised directly (no fixture.detectChanges())
// so the Monaco editor / template lifecycle stays out of the way.
describe('ArticleFormComponent (scheduledAt)', () => {
  let component: ArticleFormComponent;
  let fixture: ComponentFixture<ArticleFormComponent>;
  let mockApiService: jasmine.SpyObj<ApiService>;

  const scheduledIso = '2026-09-01T15:30:00.000Z';

  const makeArticle = (overrides: Partial<ArticleResponse> = {}): ArticleResponse => ({
    id: '5',
    slug: 'scheduled-post',
    title: 'Scheduled post',
    content: 'Some content long enough',
    contentHtml: '',
    status: 'SCHEDULED',
    scheduledAt: scheduledIso,
    author: { id: '1', name: 'Leo' },
    tags: [],
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    readingTimeMinutes: 1,
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
    ...overrides,
  } as ArticleResponse);

  /** Same ISO→datetime-local conversion the component applies (local TZ). */
  const toDatetimeLocal = (iso: string): string => {
    const date = new Date(iso);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  };

  beforeEach(async () => {
    mockApiService = jasmine.createSpyObj('ApiService', ['get', 'post', 'put', 'delete', 'upload']);
    mockApiService.get.and.returnValue(of(makeArticle()));
    mockApiService.put.and.returnValue(of(makeArticle()));
    mockApiService.post.and.returnValue(of(makeArticle()));

    const mockI18n = { t: (key: string) => key, language: signal('en') };

    await TestBed.configureTestingModule({
      imports: [ArticleFormComponent],
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: AdminApiService, useValue: jasmine.createSpyObj('AdminApiService', ['submitArticleForReview', 'approveArticleReview', 'requestArticleChanges']) },
        { provide: TagService, useValue: jasmine.createSpyObj('TagService', { getTags: of([]) }) },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error', 'warning', 'info']) },
        { provide: ThemeService, useValue: { isDark: () => false } },
        // Never-resolving load keeps Monaco fully out of these tests
        { provide: MonacoLoaderService, useValue: { load: () => new Promise<void>(() => {}) } },
        { provide: ImageOptimizerService, useValue: jasmine.createSpyObj('ImageOptimizerService', ['optimize']) },
        { provide: I18nService, useValue: mockI18n },
        { provide: ActivatedRoute, useValue: { snapshot: { params: {} } } },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ArticleFormComponent);
    component = fixture.componentInstance;
  });

  it('populates scheduledAtControl (local datetime-local format) when loading a scheduled article', () => {
    component.loadArticle('5');

    expect(component.scheduledAtControl.value).toBe(toDatetimeLocal(scheduledIso));
    expect(component.showScheduleInput()).toBeTrue();
  });

  it('clears scheduledAtControl when the loaded article has no schedule', () => {
    mockApiService.get.and.returnValue(of(makeArticle({ status: 'DRAFT', scheduledAt: undefined })));

    component.loadArticle('5');

    expect(component.scheduledAtControl.value).toBe('');
    expect(component.showScheduleInput()).toBeFalse();
  });

  it('re-sends scheduledAt on quickSave of a scheduled article', () => {
    component.articleId = '5';
    component.isEditMode.set(true);
    component.loadArticle('5'); // sets originalStatus=SCHEDULED and the control

    component.quickSave();

    expect(mockApiService.put).toHaveBeenCalled();
    const [url, body] = mockApiService.put.calls.mostRecent().args as [string, ArticleRequest];
    expect(url).toBe('/admin/articles/5');
    expect(body.status).toBe('SCHEDULED');
    // The control's local value converts back to the original UTC instant
    expect(body.scheduledAt).toBe(new Date(component.scheduledAtControl.value!).toISOString());
    expect(new Date(body.scheduledAt!).getTime()).toBe(new Date(scheduledIso).getTime());
  });

  it('sends scheduledAt on an explicit schedulePublish', () => {
    component.articleId = '5';
    component.isEditMode.set(true);
    component.loadArticle('5');

    component.schedulePublish();

    const [, body] = mockApiService.put.calls.mostRecent().args as [string, ArticleRequest];
    expect(body.status).toBe('SCHEDULED');
    expect(body.scheduledAt).toBeDefined();
  });

  it('omits scheduledAt for a draft save', () => {
    component.form.patchValue({ title: 'Draft', slug: 'draft', content: 'Draft body content' }, { emitEvent: false });
    component.scheduledAtControl.setValue('2026-09-01T12:30', { emitEvent: false });

    component.saveDraft();

    expect(mockApiService.post).toHaveBeenCalled();
    const [, body] = mockApiService.post.calls.mostRecent().args as [string, ArticleRequest];
    expect(body.status).toBe('DRAFT');
    expect(body.scheduledAt).toBeUndefined();
  });

  it('repopulates scheduledAtControl after a version restore', () => {
    component.articleId = '5';
    component.scheduledAtControl.setValue('', { emitEvent: false });

    component.onVersionRestored();

    expect(component.scheduledAtControl.value).toBe(toDatetimeLocal(scheduledIso));
  });
});
