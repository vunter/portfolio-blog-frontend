import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ArticleTranslationsComponent } from './article-translations.component';
import { AdminApiService } from '../../../../services/admin-api.service';
import { I18nService } from '../../../../../../core/services/i18n.service';
import { NotificationService } from '../../../../../../core/services/notification.service';
import { ArticleI18nResponse } from '../../../../../../models';

// AUD18-05: failed translation loads must be distinguishable from "no translations"
describe('ArticleTranslationsComponent', () => {
  let component: ArticleTranslationsComponent;
  let fixture: ComponentFixture<ArticleTranslationsComponent>;
  let mockAdminApi: jasmine.SpyObj<AdminApiService>;
  let mockNotification: jasmine.SpyObj<NotificationService>;

  const mockTranslations = [
    { articleId: '10', locale: 'pt-BR', title: 'Título', autoTranslated: true, reviewed: false, translatedAt: '2026-02-01T10:00:00Z' },
  ] as ArticleI18nResponse[];

  beforeEach(async () => {
    mockAdminApi = jasmine.createSpyObj('AdminApiService', [
      'getArticleTranslations', 'getArticleTranslationLocales', 'translateArticle', 'deleteArticleTranslation',
    ]);
    mockAdminApi.getArticleTranslations.and.returnValue(of(mockTranslations));
    mockAdminApi.getArticleTranslationLocales.and.returnValue(of(['es', 'fr']));
    mockNotification = jasmine.createSpyObj('NotificationService', ['success', 'error', 'warning', 'info']);

    const mockI18n = {
      t: (key: string) => key,
      language: signal('en'),
    };

    await TestBed.configureTestingModule({
      imports: [ArticleTranslationsComponent],
      providers: [
        { provide: AdminApiService, useValue: mockAdminApi },
        { provide: I18nService, useValue: mockI18n },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ArticleTranslationsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('articleId', '10');
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load translations and locales on init', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(mockAdminApi.getArticleTranslations).toHaveBeenCalledWith('10');
    expect(mockAdminApi.getArticleTranslationLocales).toHaveBeenCalledWith('10');
    expect(component.translations().length).toBe(1);
    expect(component.availableLocales()).toEqual(['es', 'fr']);
    expect(component.loadError()).toBeFalse();
  }));

  it('should set loadError when loading translations fails', fakeAsync(() => {
    mockAdminApi.getArticleTranslations.and.returnValue(throwError(() => new Error('Network error')));

    fixture.detectChanges();
    tick();

    expect(component.loadError()).toBeTrue();
  }));

  it('should set loadError when loading locales fails', fakeAsync(() => {
    mockAdminApi.getArticleTranslationLocales.and.returnValue(throwError(() => new Error('Network error')));

    fixture.detectChanges();
    tick();

    expect(component.loadError()).toBeTrue();
  }));

  it('should render the error state with retry instead of the empty state', fakeAsync(() => {
    mockAdminApi.getArticleTranslations.and.returnValue(throwError(() => new Error('Network error')));
    fixture.detectChanges();
    tick();

    component.showPanel.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.translation-load-error')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.translation-empty')).toBeFalsy();
  }));

  it('should retry both loads from the error state', fakeAsync(() => {
    mockAdminApi.getArticleTranslations.and.returnValue(throwError(() => new Error('Network error')));
    fixture.detectChanges();
    tick();

    mockAdminApi.getArticleTranslations.and.returnValue(of(mockTranslations));
    mockAdminApi.getArticleTranslations.calls.reset();
    mockAdminApi.getArticleTranslationLocales.calls.reset();

    component.retryLoad();
    tick();

    expect(component.loadError()).toBeFalse();
    expect(mockAdminApi.getArticleTranslations).toHaveBeenCalled();
    expect(mockAdminApi.getArticleTranslationLocales).toHaveBeenCalled();
    expect(component.translations().length).toBe(1);
  }));

  it('should translate and reload on success', fakeAsync(() => {
    mockAdminApi.translateArticle.and.returnValue(of(mockTranslations[0]));
    fixture.detectChanges();
    tick();
    mockAdminApi.getArticleTranslations.calls.reset();

    component.translate('es');
    tick();

    expect(mockAdminApi.translateArticle).toHaveBeenCalledWith('10', 'es');
    expect(mockNotification.success).toHaveBeenCalled();
    expect(mockAdminApi.getArticleTranslations).toHaveBeenCalled();
  }));
});
