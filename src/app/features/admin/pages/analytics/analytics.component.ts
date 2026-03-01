import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AdminApiService, AnalyticsSummary, SearchAnalytics, AnalyticsComparison } from '../../services/admin-api.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';

// INC-04: Mapped analytics data matching backend AnalyticsSummary DTO
interface AnalyticsData {
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  uniqueVisitors: number;
  topArticles: { articleId: string; title: string; slug: string; views: number }[];
  dailyViews: { date: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
}

@Component({
  selector: 'app-analytics',
  imports: [],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsComponent implements OnInit {
  private adminApi = inject(AdminApiService);
  private notification = inject(NotificationService);
  i18n = inject(I18nService);

  data = signal<AnalyticsData | null>(null);
  searchData = signal<SearchAnalytics | null>(null);
  comparison = signal<AnalyticsComparison | null>(null);
  loading = signal(true);
  error = signal(false);
  period = signal('30d');
  maxViews = signal(0);
  maxReferrerCount = signal(0);

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
          };
          this.data.set(mapped);
          const viewCounts = mapped.dailyViews?.map((d) => d.count) ?? [];
          this.maxViews.set(viewCounts.length > 0 ? Math.max(...viewCounts) : 0);
          const refCounts = mapped.topReferrers?.map((r) => r.count) ?? [];
          this.maxReferrerCount.set(refCounts.length > 0 ? Math.max(...refCounts) : 0);
          this.loading.set(false);
        },
        error: () => {
          this.notification.error(this.i18n.t('admin.error.loadAnalytics'));
          this.loading.set(false);
          this.error.set(true);
        },
      });
    this.adminApi.getSearchAnalytics().subscribe({
      next: (searchAnalytics) => this.searchData.set(searchAnalytics),
      error: () => this.searchData.set(null),
    });
    this.adminApi.getAnalyticsComparison(this.period()).subscribe({
      next: (comp) => this.comparison.set(comp),
      error: () => this.comparison.set(null),
    });
  }

  getBarHeight(count: number): number {
    const max = this.maxViews();
    if (max === 0) return 5;
    return Math.max((count / max) * 100, 5);
  }

  getReferrerWidth(count: number): number {
    const max = this.maxReferrerCount();
    if (max === 0) return 5;
    return Math.max((count / max) * 100, 5);
  }

  formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  calcChange(current?: number, previous?: number): { percent: number; direction: 'positive' | 'negative' | 'neutral' } {
    if (current == null || previous == null || previous === 0) {
      return { percent: current && current > 0 ? 100 : 0, direction: current && current > 0 ? 'positive' : 'neutral' };
    }
    const percent = ((current - previous) / previous) * 100;
    const rounded = Math.round(percent * 10) / 10;
    if (rounded > 0) return { percent: rounded, direction: 'positive' };
    if (rounded < 0) return { percent: Math.abs(rounded), direction: 'negative' };
    return { percent: 0, direction: 'neutral' };
  }

  exportToCsv(): void {
    const data = this.data();
    if (!data) return;

    let csv = 'Date,Views,Likes,Shares\n';
    for (const day of data.dailyViews) {
      csv += `${day.date},${day.count},0,0\n`;
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
    a.click();
    URL.revokeObjectURL(url);
  }
}
