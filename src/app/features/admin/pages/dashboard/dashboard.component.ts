import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { getDateLocale } from '../../../../core/utils/date-format.util';

// TODO F-379: Import DashboardStats from AdminApiService instead of duplicating
interface DashboardStats {
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  totalViews: number;
  totalComments: number;
  pendingComments: number;
  totalUsers: number;
  totalTags: number;
  newsletterSubscribers: number;
}

interface RecentActivity {
  id: number;
  type: 'article' | 'comment' | 'user';
  action: string;
  title: string;
  createdAt: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  // TODO F-324: Use AdminApiService.getDashboardStats() instead of direct ApiService call
  private apiService = inject(ApiService);
  private notification = inject(NotificationService);
  readonly authStore = inject(AuthStore);
  i18n = inject(I18nService);

  stats = signal<DashboardStats | null>(null);
  recentActivity = signal<RecentActivity[]>([]);
  loading = signal(true);
  error = signal(false);

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading.set(true);
    this.error.set(false);

    // HIGH-03: Use forkJoin to wait for both requests, set loading=false only when all complete
    forkJoin({
      stats: this.apiService.get<DashboardStats>('/admin/dashboard/stats'),
      activity: this.apiService.get<RecentActivity[]>('/admin/dashboard/activity'),
    }).subscribe({
      next: ({ stats, activity }) => {
        this.stats.set(stats);
        this.recentActivity.set(activity);
        this.loading.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.error.loadDashboard'));
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return this.i18n.t('admin.dashboard.justNow');
    if (diffMins < 60) return `${diffMins}${this.i18n.t('admin.dashboard.minAgo')}`;
    if (diffHours < 24) return `${diffHours}${this.i18n.t('admin.dashboard.hAgo')}`;
    if (diffDays < 7) return `${diffDays}${this.i18n.t('admin.dashboard.dAgo')}`;
    return date.toLocaleDateString(getDateLocale(this.i18n.language()));
  }
}
