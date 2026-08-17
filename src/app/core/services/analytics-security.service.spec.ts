import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AnalyticsSecurityService } from './analytics-security.service';

describe('AnalyticsSecurityService', () => {
  let service: AnalyticsSecurityService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AnalyticsSecurityService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reuses the cached token while it is still valid', async () => {
    const first = service.getToken();
    http.expectOne(r => r.url.includes('/analytics/token'))
      .flush({ token: 'tok-1', expiresAt: new Date(Date.now() + 600000).toISOString() });
    expect(await first).toBe('tok-1');

    // Second call must NOT hit the network — served from cache
    expect(await service.getToken()).toBe('tok-1');
    http.expectNone(r => r.url.includes('/analytics/token'));
  });

  it('invalidateToken drops the cache so the next getToken refetches', async () => {
    // The server side of the token can vanish independently of the client cache
    // (Redis restart/failover/flush). After a 403 the client must not keep
    // replaying a token the server no longer knows.
    const first = service.getToken();
    http.expectOne(r => r.url.includes('/analytics/token'))
      .flush({ token: 'tok-1', expiresAt: new Date(Date.now() + 600000).toISOString() });
    await first;

    service.invalidateToken();

    const second = service.getToken();
    http.expectOne(r => r.url.includes('/analytics/token'))
      .flush({ token: 'tok-2', expiresAt: new Date(Date.now() + 600000).toISOString() });
    expect(await second).toBe('tok-2');
  });
});
