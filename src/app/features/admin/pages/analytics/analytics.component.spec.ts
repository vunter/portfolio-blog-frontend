import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AnalyticsComponent } from './analytics.component';
import { AdminApiService, AnalyticsSummary, SearchAnalytics, AnalyticsComparison } from '../../services/admin-api.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';

describe('AnalyticsComponent', () => {
  let component: AnalyticsComponent;
  let fixture: ComponentFixture<AnalyticsComponent>;
  let mockAdminApi: jasmine.SpyObj<AdminApiService>;
  let mockNotification: jasmine.SpyObj<NotificationService>;

  const mockSummary: AnalyticsSummary = {
    totalViews: 1200,
    totalLikes: 40,
    totalShares: 12,
    uniqueVisitors: 300,
    topArticles: [{ articleId: '1', title: 'Hello', slug: 'hello', views: 500 }],
    dailyViews: [
      { date: '2026-08-01', count: 10 },
      { date: '2026-08-02', count: 20 },
    ],
    topReferrers: [{ referrer: 'google.com', count: 80 }],
    topSources: [{ source: 'twitter', medium: 'social', count: 30 }],
    topDevices: [
      { deviceType: 'DESKTOP', count: 200 },
      { deviceType: 'MOBILE', count: 90 },
    ],
    topBrowsers: [
      { browser: 'Chrome', count: 150 },
      { browser: 'Firefox', count: 60 },
      { browser: 'Samsung Internet', count: 10 },
    ],
    topCountries: [
      { countryCode: 'BR', count: 180 },
      { countryCode: 'US', count: 70 },
    ],
  };

  const mockSearch: SearchAnalytics = {
    totalSearches: 5,
    uniqueSearches: 3,
    topSearches: [],
    zeroResultSearches: [],
  };

  const mockComparison: AnalyticsComparison = {
    currentViews: 1200,
    currentLikes: 40,
    currentShares: 12,
    previousViews: 1000,
    previousLikes: 50,
    previousShares: 12,
  };

  beforeEach(async () => {
    mockAdminApi = jasmine.createSpyObj('AdminApiService', [
      'getAnalytics',
      'getAnalyticsSummary',
      'getSearchAnalytics',
      'getAnalyticsComparison',
    ]);
    mockAdminApi.getAnalytics.and.returnValue(of(mockSummary));
    mockAdminApi.getAnalyticsSummary.and.returnValue(of(mockSummary));
    mockAdminApi.getSearchAnalytics.and.returnValue(of(mockSearch));
    mockAdminApi.getAnalyticsComparison.and.returnValue(of(mockComparison));

    mockNotification = jasmine.createSpyObj('NotificationService', ['success', 'error', 'warning', 'info']);

    const mockI18n = {
      t: (key: string) => key,
      language: signal('en'),
    };

    await TestBed.configureTestingModule({
      imports: [AnalyticsComponent],
      providers: [
        { provide: AdminApiService, useValue: mockAdminApi },
        { provide: I18nService, useValue: mockI18n },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // ==================== AUD19: audience summary fetch ====================

  it('should fetch the analytics summary with 30 days on load (default period)', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(mockAdminApi.getAnalyticsSummary).toHaveBeenCalledWith(30);
    expect(component.audience()?.topDevices.length).toBe(2);
    expect(component.audienceLoading()).toBeFalse();
  }));

  it('should translate the period selector to days and refetch on change', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    mockAdminApi.getAnalyticsSummary.calls.reset();

    component.setPeriod('7d');
    tick();
    expect(mockAdminApi.getAnalyticsSummary).toHaveBeenCalledWith(7);

    component.setPeriod('90d');
    tick();
    expect(mockAdminApi.getAnalyticsSummary).toHaveBeenCalledWith(90);
  }));

  it('should fall back to 30 days for unparseable periods and clamp to 365', () => {
    expect(component.periodToDays('7d')).toBe(7);
    expect(component.periodToDays('30d')).toBe(30);
    expect(component.periodToDays('90d')).toBe(90);
    expect(component.periodToDays('bogus')).toBe(30);
    expect(component.periodToDays('')).toBe(30);
    expect(component.periodToDays('9999d')).toBe(365);
  });

  // ==================== AUD19: audience rendering ====================

  it('should render the three audience cards with ranked rows', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.audience-grid .chart-card');
    expect(cards.length).toBe(3);

    const deviceRows = cards[0].querySelectorAll('.source-item');
    const browserRows = cards[1].querySelectorAll('.source-item');
    const countryRows = cards[2].querySelectorAll('.source-item');
    expect(deviceRows.length).toBe(2);
    expect(browserRows.length).toBe(3);
    expect(countryRows.length).toBe(2);

    // Labels are humanized and counts rendered as text
    expect(deviceRows[0].textContent).toContain('Desktop');
    expect(deviceRows[0].textContent).toContain('200');
    expect(browserRows[0].textContent).toContain('Chrome');
    expect(countryRows[0].textContent).toContain('Brazil');
    expect(countryRows[0].textContent).toContain('BR');

    // Bars are decorative: aria-hidden and proportional width
    const bars = cards[0].querySelectorAll('.source-bar');
    expect(bars[0].getAttribute('aria-hidden')).toBe('true');
    const topFill = bars[0].querySelector('.source-bar__fill') as HTMLElement;
    expect(topFill.style.width).toBe('100%');
  }));

  it('should show the empty state per card when arrays are empty', fakeAsync(() => {
    mockAdminApi.getAnalyticsSummary.and.returnValue(
      of({ ...mockSummary, topDevices: [], topBrowsers: [], topCountries: [] })
    );

    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const empties = fixture.nativeElement.querySelectorAll('.audience-grid .chart-empty');
    expect(empties.length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.audience-list').length).toBe(0);
  }));

  it('should treat missing audience arrays as empty (defensive mapping)', fakeAsync(() => {
    const partial = { ...mockSummary } as Partial<AnalyticsSummary>;
    delete partial.topDevices;
    delete partial.topBrowsers;
    delete partial.topCountries;
    mockAdminApi.getAnalyticsSummary.and.returnValue(of(partial as AnalyticsSummary));

    fixture.detectChanges();
    tick();

    expect(component.audience()).toEqual({ topDevices: [], topBrowsers: [], topCountries: [] });
  }));

  // ==================== AUD19: error + retry ====================

  it('should set audience error state without touching the main page on summary failure', fakeAsync(() => {
    mockAdminApi.getAnalyticsSummary.and.returnValue(throwError(() => new Error('fail')));

    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(component.audienceError()).toBeTrue();
    expect(component.audienceLoading()).toBeFalse();
    expect(component.error()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.audience-error')).toBeTruthy();
  }));

  it('should refetch the summary when the inline retry button is clicked', fakeAsync(() => {
    mockAdminApi.getAnalyticsSummary.and.returnValue(throwError(() => new Error('fail')));
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    mockAdminApi.getAnalyticsSummary.calls.reset();
    mockAdminApi.getAnalyticsSummary.and.returnValue(of(mockSummary));

    const retryBtn = fixture.nativeElement.querySelector('.audience-error .retry-btn') as HTMLButtonElement;
    expect(retryBtn).toBeTruthy();
    retryBtn.click();
    tick();
    fixture.detectChanges();

    expect(mockAdminApi.getAnalyticsSummary).toHaveBeenCalledWith(30);
    expect(component.audienceError()).toBeFalse();
    expect(fixture.nativeElement.querySelectorAll('.audience-grid .chart-card').length).toBe(3);
  }));

  // ==================== AUD19: label helpers ====================

  it('should humanize device types and map empty/unknown to the i18n label', () => {
    expect(component.deviceLabel('DESKTOP')).toBe('Desktop');
    expect(component.deviceLabel('MOBILE')).toBe('Mobile');
    expect(component.deviceLabel('TABLET')).toBe('Tablet');
    expect(component.deviceLabel('UNKNOWN')).toBe('dev.analytics.unknown');
    expect(component.deviceLabel('')).toBe('dev.analytics.unknown');
    expect(component.deviceLabel(null)).toBe('dev.analytics.unknown');
    expect(component.deviceLabel(undefined)).toBe('dev.analytics.unknown');
  });

  it('should pass through backend browser families and map unknown values', () => {
    expect(component.browserLabel('Chrome')).toBe('Chrome');
    expect(component.browserLabel('Samsung Internet')).toBe('Samsung Internet');
    expect(component.browserLabel('Unknown')).toBe('dev.analytics.unknown');
    expect(component.browserLabel('')).toBe('dev.analytics.unknown');
    expect(component.browserLabel(undefined)).toBe('dev.analytics.unknown');
  });

  it('should resolve country names via Intl.DisplayNames in the current locale', () => {
    expect(component.countryName('US')).toBe('United States');
    expect(component.countryName('br')).toBe('Brazil');
  });

  it('should fall back to the raw code when Intl has no name or the code is invalid', () => {
    // No localized name available: Intl returns the code itself (stubbed for determinism —
    // real browsers differ on unassigned codes like ZZ)
    spyOn(Intl.DisplayNames.prototype, 'of').and.callFake((code: string) => code);
    expect(component.countryName('ZZ')).toBe('ZZ');
    // Invalid syntax: Intl.DisplayNames.of throws RangeError — helper catches it
    (Intl.DisplayNames.prototype.of as jasmine.Spy).and.callFake(() => {
      throw new RangeError('invalid region');
    });
    expect(component.countryName('a')).toBe('A');
  });

  it('should map missing/unknown country codes to the i18n label and hide the badge', () => {
    expect(component.countryName(undefined)).toBe('dev.analytics.unknown');
    expect(component.countryName('')).toBe('dev.analytics.unknown');
    expect(component.countryName('unknown')).toBe('dev.analytics.unknown');
    expect(component.countryCodeLabel('unknown')).toBe('');
    expect(component.countryCodeLabel(undefined)).toBe('');
    expect(component.countryCodeLabel('br')).toBe('BR');
  });

  // ==================== existing page behavior (regression guard) ====================

  it('should still load the main analytics via the period endpoint', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(mockAdminApi.getAnalytics).toHaveBeenCalledWith('30d');
    expect(component.data()?.totalViews).toBe(1200);
    expect(component.loading()).toBeFalse();
  }));
});
