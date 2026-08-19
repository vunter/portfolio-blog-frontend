import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ArticleReviewPanelComponent } from './article-review-panel.component';
import { AdminApiService } from '../../../../services/admin-api.service';
import { I18nService } from '../../../../../../core/services/i18n.service';
import { ArticleReview } from '../../../../../../models';

// AUD18-05: failed review-history loads must be distinguishable from an empty history
describe('ArticleReviewPanelComponent', () => {
  let component: ArticleReviewPanelComponent;
  let fixture: ComponentFixture<ArticleReviewPanelComponent>;
  let mockAdminApi: jasmine.SpyObj<AdminApiService>;

  const mockReviews: ArticleReview[] = [
    { id: '1', articleId: '10', reviewerId: '2', status: 'APPROVED', createdAt: '2026-02-01T10:00:00Z' },
    { id: '2', articleId: '10', reviewerId: '3', status: 'CHANGES_REQUESTED', feedback: 'Fix intro', createdAt: '2026-02-02T10:00:00Z' },
  ];

  beforeEach(async () => {
    mockAdminApi = jasmine.createSpyObj('AdminApiService', ['getArticleReviews']);
    mockAdminApi.getArticleReviews.and.returnValue(of(mockReviews));

    const mockI18n = {
      t: (key: string) => key,
      language: signal('en'),
    };

    await TestBed.configureTestingModule({
      imports: [ArticleReviewPanelComponent],
      providers: [
        { provide: AdminApiService, useValue: mockAdminApi },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ArticleReviewPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('articleId', '10');
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load review history on init', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(mockAdminApi.getArticleReviews).toHaveBeenCalledWith('10');
    expect(component.reviewHistory().length).toBe(2);
    expect(component.loadError()).toBeFalse();
  }));

  it('should set loadError when the load fails instead of showing an empty history', fakeAsync(() => {
    mockAdminApi.getArticleReviews.and.returnValue(throwError(() => new Error('Network error')));

    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(component.loadError()).toBeTrue();
    const errorEl = fixture.nativeElement.querySelector('.review-load-error');
    expect(errorEl).toBeTruthy();
    // The misleading "no reviews" empty state must NOT render on failure
    expect(fixture.nativeElement.querySelector('.review-empty')).toBeFalsy();
  }));

  it('should retry the load from the error state', fakeAsync(() => {
    mockAdminApi.getArticleReviews.and.returnValue(throwError(() => new Error('Network error')));
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    mockAdminApi.getArticleReviews.and.returnValue(of(mockReviews));
    const retryBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.review-load-error button');
    retryBtn.click();
    tick();
    fixture.detectChanges();

    expect(component.loadError()).toBeFalse();
    expect(component.reviewHistory().length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.review-entry').length).toBe(2);
  }));

  it('should emit feedback when requesting changes', () => {
    fixture.detectChanges();

    let emitted: string | undefined;
    component.changesRequested.subscribe((feedback: string) => (emitted = feedback));
    component.feedbackText.set('Please expand the summary');
    component.requestChanges();

    expect(emitted).toBe('Please expand the summary');
  });
});
