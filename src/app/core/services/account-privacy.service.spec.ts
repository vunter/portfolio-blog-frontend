import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AccountPrivacyService } from './account-privacy.service';

describe('AccountPrivacyService', () => {
  let service: AccountPrivacyService;
  let httpMock: HttpTestingController;

  const baseUrl = '/api/v1';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AccountPrivacyService,
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AccountPrivacyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getNewsletterStatus issues GET /account/newsletter', () => {
    const mock = {
      subscribed: true,
      linked: true,
      subscriberStatus: 'CONFIRMED',
      linkedAt: '2026-08-01T10:00:00Z',
      emailAnalyticsConsent: false,
    };

    service.getNewsletterStatus().subscribe((status) => {
      expect(status).toEqual(mock);
    });

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/account/newsletter`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
  });

  it('linkNewsletter issues POST /account/newsletter/link', () => {
    service.linkNewsletter().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/account/newsletter/link`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('unlinkNewsletter issues DELETE /account/newsletter/link', () => {
    service.unlinkNewsletter().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/account/newsletter/link`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('subscribeNewsletter issues POST /account/newsletter/subscribe', () => {
    service.subscribeNewsletter().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/account/newsletter/subscribe`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('unsubscribeNewsletter issues POST /account/newsletter/unsubscribe', () => {
    service.unsubscribeNewsletter().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/account/newsletter/unsubscribe`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('getConsent issues GET /account/consent', () => {
    const mock = { siteAnalyticsConsent: true, emailAnalyticsConsent: null };

    service.getConsent().subscribe((consent) => {
      expect(consent).toEqual(mock);
    });

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/account/consent`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
  });

  it('updateConsent PUTs only the provided fields', () => {
    service.updateConsent({ emailAnalyticsConsent: true }).subscribe((consent) => {
      expect(consent.emailAnalyticsConsent).toBeTrue();
    });

    const req = httpMock.expectOne(`${baseUrl}/account/consent`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ emailAnalyticsConsent: true });
    req.flush({ siteAnalyticsConsent: null, emailAnalyticsConsent: true });
  });

  it('getDeletionPreview issues GET /account/deletion-preview', () => {
    const mock = {
      newsletterLinked: true,
      newsletterStatus: 'CONFIRMED',
      commentsCount: 4,
      articlesCount: 0,
    };

    service.getDeletionPreview().subscribe((preview) => {
      expect(preview).toEqual(mock);
    });

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/account/deletion-preview`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
  });

  it('deleteAccount issues DELETE /account with the re-authentication body', () => {
    const body = { password: 's3cret', mode: 'ERASE' as const, cancelNewsletter: true };

    service.deleteAccount(body).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/account`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual(body);
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('deleteAccount propagates 401 (wrong password) to the caller', () => {
    let status = 0;
    service.deleteAccount({ password: 'wrong', mode: 'DEACTIVATE', cancelNewsletter: false }).subscribe({
      error: (err) => (status = err.status),
    });

    const req = httpMock.expectOne(`${baseUrl}/account`);
    req.flush({ message: 'bad credentials' }, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
  });
});
