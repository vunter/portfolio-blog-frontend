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

  it('hands each concurrent caller its own solved challenge (solutions are single-use)', async () => {
    // PoW solutions are consumed server-side via getAndDelete: two callers
    // sharing one {challengeId, solution} means the second POST gets a 400
    // "invalid proof of work". Concurrent requests must each solve their own.
    const tick = () => new Promise(resolve => setTimeout(resolve));
    const first = service.getSolvedChallenge();
    const second = service.getSolvedChallenge();

    // difficulty 0 => any attempt matches, solver returns immediately
    const flushNext = (id: string) => {
      const req = http.expectOne(r => r.url.includes('/analytics/challenge'));
      req.flush({ challengeId: id, nonce: 'n-' + id, difficulty: 0, expiresAt: new Date(Date.now() + 60000).toISOString() });
    };
    await tick();
    flushNext('ch-1');
    const a = await first;
    await tick();
    flushNext('ch-2');
    const b = await second;
    // background pre-solve kicked off after consumption — satisfy and discard
    await tick();
    http.match(r => r.url.includes('/analytics/challenge')).forEach((req, i) =>
      req.flush({ challengeId: 'pre-' + i, nonce: 'pn' + i, difficulty: 0, expiresAt: new Date(Date.now() + 60000).toISOString() }));
    await tick();

    expect(a?.challengeId).toBe('ch-1');
    expect(b?.challengeId).toBe('ch-2');
    expect(a?.challengeId).not.toBe(b?.challengeId);
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
