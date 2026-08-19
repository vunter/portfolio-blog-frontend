import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { MfaService } from './mfa.service';

describe('MfaService', () => {
  let service: MfaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MfaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // AUD19C-A3FE: disabling MFA is re-authenticated — the current password must
  // travel in the DELETE body, with credentials, so the backend can verify it.
  it('disable() sends DELETE with { password } body and credentials', () => {
    service.disable('s3cret').subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/admin/mfa/disable'));
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ password: 's3cret' });
    expect(req.request.withCredentials).toBeTrue();
    req.flush(null);
  });

  it('verifyLogin() posts the challenge token, code and method', () => {
    service.verifyLogin({ mfaToken: 'tok', code: '123456', method: 'TOTP' }).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/admin/mfa/verify'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ mfaToken: 'tok', code: '123456', method: 'TOTP' });
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ tokenType: 'Bearer', expiresIn: 900, email: 'a@b.c', name: 'A' });
  });
});
