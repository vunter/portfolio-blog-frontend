import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminApiService, SearchAnalytics, AnalyticsComparison } from '../../services/admin-api.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';

// INC-04: Mapped analytics data matching backend AnalyticsSummary DTO
interface AnalyticsData {
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  uniqueVisitors: number;
  topArticles: { articleId: string; title: string; slug: string; views: number }[];
  dailyViews: { date: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  topSources: { source: string; medium: string; count: number }[];
}

// AUD19: Audience breakdown from GET /admin/analytics/summary?days=N —
// device_type/browser_family are parsed server-side (DeviceParser) and
// country_code is a GeoIP ISO 3166-1 alpha-2 code.
interface AudienceData {
  topDevices: { deviceType: string; count: number }[];
  topBrowsers: { browser: string; count: number }[];
  topCountries: { countryCode: string; count: number }[];
}

@Component({
  selector: 'app-analytics',
  imports: [SkeletonComponent],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsComponent implements OnInit {
  private adminApi = inject(AdminApiService);
  private notification = inject(NotificationService);
  private destroyRef = inject(DestroyRef);
  i18n = inject(I18nService);

  data = signal<AnalyticsData | null>(null);
  searchData = signal<SearchAnalytics | null>(null);
  comparison = signal<AnalyticsComparison | null>(null);
  loading = signal(true);
  error = signal(false);
  period = signal('30d');
  maxViews = signal(0);
  maxReferrerCount = signal(0);
  maxSourceCount = signal(0);

  // AUD19: Audience section state — separate endpoint (getAnalyticsSummary),
  // so it gets its own loading/error lifecycle with an inline retry.
  audience = signal<AudienceData | null>(null);
  audienceLoading = signal(true);
  audienceError = signal(false);

  readonly maxDeviceCount = computed(() => Math.max(0, ...(this.audience()?.topDevices ?? []).map((d) => d.count)));
  readonly maxBrowserCount = computed(() => Math.max(0, ...(this.audience()?.topBrowsers ?? []).map((b) => b.count)));
  readonly maxCountryCount = computed(() => Math.max(0, ...(this.audience()?.topCountries ?? []).map((c) => c.count)));

  // Intl.DisplayNames is cached per locale — recreated lazily when the UI language changes.
  private regionNamesLocale: string | null = null;
  private regionNames: Intl.DisplayNames | null = null;

  readonly viewsChange = computed(() => this.calcChange(this.comparison()?.currentViews, this.comparison()?.previousViews));
  readonly likesChange = computed(() => this.calcChange(this.comparison()?.currentLikes, this.comparison()?.previousLikes));
  readonly sharesChange = computed(() => this.calcChange(this.comparison()?.currentShares, this.comparison()?.previousShares));

  readonly svgPolyline = computed(() => {
    const d = this.data();
    if (!d || d.dailyViews.length < 2) return '';
    const max = this.maxViews() || 1;
    const points = d.dailyViews.map((day, i) => {
      const x = (i / (d.dailyViews.length - 1)) * 100;
      const y = 100 - (day.count / max) * 100;
      return `${x},${y}`;
    });
    return points.join(' ');
  });

  readonly hasAnyData = computed(() => {
    const d = this.data();
    if (!d) return false;
    return d.totalViews > 0 || d.uniqueVisitors > 0 || d.totalLikes > 0 || d.totalShares > 0 ||
           d.dailyViews.length > 0 || d.topReferrers.length > 0 || d.topArticles.length > 0;
  });

  ngOnInit(): void {
    this.loadAnalytics();
  }

  setPeriod(period: string): void {
    this.period.set(period);
    this.loadAnalytics();
  }

  loadAnalytics(): void {
    this.error.set(false);
    this.adminApi
      .getAnalytics(this.period())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          // INC-04: Map backend AnalyticsSummary to frontend AnalyticsData
          const mapped: AnalyticsData = {
            totalViews: summary.totalViews ?? 0,
            totalLikes: summary.totalLikes ?? 0,
            totalShares: summary.totalShares ?? 0,
            uniqueVisitors: summary.uniqueVisitors ?? 0,
            topArticles: summary.topArticles ?? [],
            dailyViews: summary.dailyViews ?? [],
            topReferrers: summary.topReferrers ?? [],
            topSources: summary.topSources ?? [],
          };
          this.data.set(mapped);
          const viewCounts = mapped.dailyViews?.map((d) => d.count) ?? [];
          this.maxViews.set(viewCounts.length > 0 ? Math.max(...viewCounts) : 0);
          const refCounts = mapped.topReferrers?.map((r) => r.count) ?? [];
          this.maxReferrerCount.set(refCounts.length > 0 ? Math.max(...refCounts) : 0);
          const srcCounts = mapped.topSources?.map((s) => s.count) ?? [];
          this.maxSourceCount.set(srcCounts.length > 0 ? Math.max(...srcCounts) : 0);
          this.loading.set(false);
        },
        error: () => {
          this.notification.error(this.i18n.t('dev.error.loadAnalytics'));
          this.loading.set(false);
          this.error.set(true);
        },
      });
    this.adminApi.getSearchAnalytics().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (searchAnalytics) => this.searchData.set(searchAnalytics),
      error: () => this.searchData.set(null),
    });
    this.adminApi.getAnalyticsComparison(this.period()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (comp) => this.comparison.set(comp),
      error: () => this.comparison.set(null),
    });
    this.loadAudience();
  }

  // AUD19: Audience data comes from the summary endpoint, which takes an int
  // `days` param — translate the page's period string ('7d'/'30d'/'90d') to days.
  loadAudience(): void {
    this.audienceLoading.set(true);
    this.audienceError.set(false);
    this.adminApi
      .getAnalyticsSummary(this.periodToDays(this.period()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.audience.set({
            topDevices: summary.topDevices ?? [],
            topBrowsers: summary.topBrowsers ?? [],
            topCountries: summary.topCountries ?? [],
          });
          this.audienceLoading.set(false);
        },
        error: () => {
          this.audienceLoading.set(false);
          this.audienceError.set(true);
        },
      });
  }

  // Mirrors backend AdminAnalyticsController.parsePeriod: clamp to [1, 365], default 30.
  periodToDays(period: string): number {
    const days = parseInt(period, 10);
    if (!Number.isFinite(days) || days < 1) return 30;
    return Math.min(days, 365);
  }

  getBarHeight(count: number): number {
    // A zero-view day must read as zero — flooring it at 5% made empty days look
    // like low-traffic days. Only give non-zero days a small minimum for visibility.
    if (count <= 0) return 0;
    const max = this.maxViews();
    if (max === 0) return 0;
    return Math.max((count / max) * 100, 2);
  }

  getReferrerWidth(count: number): number {
    const max = this.maxReferrerCount();
    if (max === 0) return 5;
    return Math.max((count / max) * 100, 5);
  }

  getSourceWidth(count: number): number {
    const max = this.maxSourceCount();
    if (max === 0) return 5;
    return Math.max((count / max) * 100, 5);
  }

  // AUD19: proportional bar for the audience cards (same 5% visibility floor
  // as the referrer/source bars).
  getAudienceWidth(count: number, max: number): number {
    if (max <= 0) return 5;
    return Math.max((count / max) * 100, 5);
  }

  // AUD19: backend DeviceParser emits uppercase enums (DESKTOP/MOBILE/TABLET/BOT/UNKNOWN).
  deviceLabel(deviceType: string | null | undefined): string {
    const value = deviceType?.trim();
    if (!value || value.toUpperCase() === 'UNKNOWN') {
      return this.i18n.t('dev.analytics.unknown');
    }
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }

  // AUD19: browser_family is already human-cased server-side ("Chrome", "Samsung Internet", …).
  browserLabel(browser: string | null | undefined): string {
    const value = browser?.trim();
    if (!value || value.toLowerCase() === 'unknown') {
      return this.i18n.t('dev.analytics.unknown');
    }
    return value;
  }

  // AUD19: readable region name for a GeoIP ISO 3166-1 alpha-2 code, in the
  // current UI locale. Falls back to the raw code when Intl.DisplayNames is
  // unavailable, the code is invalid, or no localized name exists.
  countryName(code: string | null | undefined): string {
    const raw = code?.trim();
    if (!raw || raw.toLowerCase() === 'unknown') {
      return this.i18n.t('dev.analytics.unknown');
    }
    const upper = raw.toUpperCase();
    const names = this.getRegionNames();
    if (names) {
      try {
        const name = names.of(upper);
        if (name && name !== upper) return name;
      } catch {
        // Invalid region code syntax (RangeError) — fall through to raw code.
      }
    }
    return upper;
  }

  // AUD19: ISO code badge next to the readable name; empty for unknown values.
  countryCodeLabel(code: string | null | undefined): string {
    const raw = code?.trim();
    if (!raw || raw.toLowerCase() === 'unknown') return '';
    return raw.toUpperCase();
  }

  private getRegionNames(): Intl.DisplayNames | null {
    const locale = this.i18n.language();
    if (this.regionNamesLocale === locale) return this.regionNames;
    this.regionNamesLocale = locale;
    this.regionNames = null;
    if (typeof Intl !== 'undefined' && 'DisplayNames' in Intl) {
      try {
        this.regionNames = new Intl.DisplayNames([locale], { type: 'region' });
      } catch {
        // Unsupported locale tag — try English before giving up.
        try {
          this.regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
        } catch {
          this.regionNames = null;
        }
      }
    }
    return this.regionNames;
  }

  getSourceIcon(source: string): string {
    const icons: Record<string, string> = {
      twitter: '𝕏', facebook: '📘', linkedin: '💼',
      clipboard: '📋', native: '📤', email: '📧',
      google: '🔍', reddit: '🔗', whatsapp: '💬',
    };
    return icons[source?.toLowerCase()] ?? '🌐';
  }

  formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  calcChange(current?: number, previous?: number): { percent: number; direction: 'positive' | 'negative' | 'neutral'; isNew: boolean } {
    if (current == null || previous == null) {
      return { percent: 0, direction: 'neutral', isNew: false };
    }
    if (previous === 0) {
      // No prior-period baseline: "+100%" would be a fabricated figure — flag as
      // new so the UI can say "new" instead of an invented percentage.
      return { percent: 0, direction: current > 0 ? 'positive' : 'neutral', isNew: current > 0 };
    }
    const percent = ((current - previous) / previous) * 100;
    const rounded = Math.round(percent * 10) / 10;
    if (rounded > 0) return { percent: rounded, direction: 'positive', isNew: false };
    if (rounded < 0) return { percent: Math.abs(rounded), direction: 'negative', isNew: false };
    return { percent: 0, direction: 'neutral', isNew: false };
  }

  exportToCsv(): void {
    const data = this.data();
    if (!data) return;

    // dailyViews only carries a view count per day — don't emit fabricated
    // Likes/Shares columns (they were hardcoded 0 and misled anyone using the export).
    let csv = 'Date,Views\n';
    for (const day of data.dailyViews) {
      csv += `${day.date},${day.count}\n`;
    }
    csv += '\nTop Articles\nTitle,Views\n';
    for (const article of data.topArticles) {
      csv += `"${article.title.replace(/"/g, '""')}",${article.views}\n`;
    }
    csv += '\nTop Referrers\nReferrer,Count\n';
    for (const ref of data.topReferrers) {
      csv += `"${ref.referrer.replace(/"/g, '""')}",${ref.count}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}
