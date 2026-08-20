import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { VerifyEmailComponent } from './verify-email.component';
import { I18nService } from '../../../../core/services/i18n.service';

describe('VerifyEmailComponent', () => {
  let httpMock: HttpTestingController;

  const mockI18n = {
    t: (key: string) => key,
    language: signal('en'),
  };

  async function setup(token: string | null): Promise<ComponentFixture<VerifyEmailComponent>> {
    const queryParams: Record<string, string> = token !== null ? { token } : {};
    await TestBed.configureTestingModule({
      imports: [VerifyEmailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: mockI18n },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.createComponent(VerifyEmailComponent);
  }

  afterEach(() => {
    httpMock?.verify();
  });

  it('starts in the loading state', async () => {
    const fixture = await setup('tok');
    expect(fixture.componentInstance.state()).toBe('loading');
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.endsWith('/admin/auth/verify-email')).flush({ message: 'ok' });
  });

  it('calls the API with the token from the query string and shows success', async () => {
    const fixture = await setup('tok');
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) => r.url.endsWith('/admin/auth/verify-email') && r.params.get('token') === 'tok'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ message: 'email.verified' });
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('success');
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('auth.verifyEmail.successTitle');
    expect(compiled.querySelector('a[href="/auth/login"]')).toBeTruthy();
  });

  it('shows the error state when the API rejects the token', async () => {
    const fixture = await setup('expired');
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith('/admin/auth/verify-email'));
    req.flush({ message: 'invalid' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('error');
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('[role="alert"]')?.textContent).toContain('auth.verifyEmail.errorBody');
  });

  it('shows the error state without calling the API when the token is missing', async () => {
    const fixture = await setup(null);
    fixture.detectChanges();

    httpMock.expectNone((r) => r.url.endsWith('/admin/auth/verify-email'));
    expect(fixture.componentInstance.state()).toBe('error');
  });
});
