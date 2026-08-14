import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { NewsletterPrivacyComponent } from './newsletter-privacy.component';
import {
  AccountPrivacyService,
  AccountConsent,
  NewsletterAccountStatus,
} from '../../../../core/services/account-privacy.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';

describe('NewsletterPrivacyComponent', () => {
  let component: NewsletterPrivacyComponent;
  let fixture: ComponentFixture<NewsletterPrivacyComponent>;
  let mockService: jasmine.SpyObj<AccountPrivacyService>;
  let mockNotification: jasmine.SpyObj<NotificationService>;

  const linkedNewsletter: NewsletterAccountStatus = {
    subscribed: true,
    linked: true,
    subscriberStatus: 'CONFIRMED',
    linkedAt: '2026-08-01T10:00:00Z',
    emailAnalyticsConsent: true,
  };

  const consent: AccountConsent = {
    siteAnalyticsConsent: true,
    emailAnalyticsConsent: null,
  };

  beforeEach(async () => {
    mockService = jasmine.createSpyObj('AccountPrivacyService', [
      'getNewsletterStatus',
      'getConsent',
      'updateConsent',
      'linkNewsletter',
      'unlinkNewsletter',
      'subscribeNewsletter',
      'unsubscribeNewsletter',
    ]);
    mockNotification = jasmine.createSpyObj('NotificationService', ['success', 'error', 'warning', 'info']);

    mockService.getNewsletterStatus.and.returnValue(of(linkedNewsletter));
    mockService.getConsent.and.returnValue(of(consent));

    const mockI18n = {
      t: (key: string) => key,
      language: signal('en'),
    };

    await TestBed.configureTestingModule({
      imports: [NewsletterPrivacyComponent],
      providers: [
        provideRouter([]),
        { provide: AccountPrivacyService, useValue: mockService },
        { provide: NotificationService, useValue: mockNotification },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewsletterPrivacyComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('loads newsletter status and consents on init', () => {
    fixture.detectChanges();

    expect(mockService.getNewsletterStatus).toHaveBeenCalled();
    expect(mockService.getConsent).toHaveBeenCalled();
    expect(component.newsletter()).toEqual(linkedNewsletter);
    expect(component.consent()).toEqual(consent);
    expect(component.loading()).toBeFalse();
  });

  it('shows an error state when loading fails', () => {
    mockService.getConsent.and.returnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();

    expect(component.loadFailed()).toBeTrue();
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('renders both consent switches with distinct purposes', () => {
    fixture.detectChanges();
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#site-analytics-consent')).toBeTruthy();
    expect(compiled.querySelector('#email-analytics-consent')).toBeTruthy();
    expect(compiled.querySelector('#site-analytics-purpose')?.textContent)
      .toContain('account.privacy.siteAnalyticsPurpose');
    expect(compiled.querySelector('#email-analytics-purpose')?.textContent)
      .toContain('account.privacy.emailAnalyticsPurpose');
  });

  it('PUTs only the toggled consent field', () => {
    mockService.updateConsent.and.returnValue(
      of({ siteAnalyticsConsent: true, emailAnalyticsConsent: true })
    );
    fixture.detectChanges();

    const emailToggle: HTMLInputElement = fixture.nativeElement.querySelector('#email-analytics-consent');
    emailToggle.checked = true;
    emailToggle.dispatchEvent(new Event('change'));

    expect(mockService.updateConsent).toHaveBeenCalledWith({ emailAnalyticsConsent: true });
    expect(component.consent()?.emailAnalyticsConsent).toBeTrue();
    expect(mockNotification.success).toHaveBeenCalled();
  });

  it('notifies and keeps state on consent save failure', () => {
    mockService.updateConsent.and.returnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();

    component.setConsent('site', false);

    expect(mockNotification.error).toHaveBeenCalled();
    expect(component.savingConsent()).toBeNull();
    expect(component.consent()).toEqual(consent);
  });

  it('shows the linked state with the unlink action when linked', () => {
    fixture.detectChanges();
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.textContent).toContain('account.privacy.nlLinkedSince');
    const buttons = Array.from(compiled.querySelectorAll('.nl-actions button')).map(
      (b) => b.textContent?.trim()
    );
    expect(buttons.some((t) => t?.includes('account.privacy.unlinkBtn'))).toBeTrue();
  });

  it('unlinks the subscription and refreshes the status', () => {
    mockService.unlinkNewsletter.and.returnValue(of(void 0));
    fixture.detectChanges();

    const unlinked = { ...linkedNewsletter, linked: false, linkedAt: null };
    mockService.getNewsletterStatus.and.returnValue(of(unlinked));

    component.runNewsletterAction('unlink');

    expect(mockService.unlinkNewsletter).toHaveBeenCalled();
    expect(mockNotification.success).toHaveBeenCalled();
    expect(component.newsletter()).toEqual(unlinked);
  });

  it('offers the link action when subscribed but not linked', () => {
    mockService.getNewsletterStatus.and.returnValue(
      of({ ...linkedNewsletter, linked: false, linkedAt: null })
    );
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('account.privacy.nlNotLinked');
    const buttons = Array.from(compiled.querySelectorAll('.nl-actions button')).map(
      (b) => b.textContent?.trim()
    );
    expect(buttons.some((t) => t?.includes('account.privacy.linkBtn'))).toBeTrue();
  });

  it('offers the subscribe action when not subscribed', () => {
    mockService.getNewsletterStatus.and.returnValue(
      of({
        subscribed: false,
        linked: false,
        subscriberStatus: null,
        linkedAt: null,
        emailAnalyticsConsent: null,
      })
    );
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('account.privacy.nlNotSubscribed');
    const buttons = Array.from(compiled.querySelectorAll('.nl-actions button')).map(
      (b) => b.textContent?.trim()
    );
    expect(buttons.some((t) => t?.includes('account.privacy.subscribeBtn'))).toBeTrue();
  });

  it('notifies on newsletter action failure', () => {
    mockService.unlinkNewsletter.and.returnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();

    component.runNewsletterAction('unlink');

    expect(mockNotification.error).toHaveBeenCalled();
    expect(component.pendingAction()).toBeNull();
  });
});
