import { Component, inject, signal, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminApiService, DashboardStats, DashboardActivity } from '../../services/admin-api.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { getDateLocale } from '../../../../core/utils/date-format.util';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, SkeletonComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private adminApi = inject(AdminApiService);
  private notification = inject(NotificationService);
  readonly authStore = inject(AuthStore);
  i18n = inject(I18nService);

  stats = signal<DashboardStats | null>(null);
  recentActivity = signal<DashboardActivity[]>([]);
  loading = signal(true);
  error = signal(false);

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading.set(true);
    this.error.set(false);

    forkJoin({
      stats: this.adminApi.getDashboardStats(),
      activity: this.adminApi.getDashboardActivity(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ stats, activity }) => {
        this.stats.set(stats);
        this.recentActivity.set(activity);
        this.loading.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('dev.error.loadDashboard'));
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

    if (diffMins < 1) return this.i18n.t('dev.dashboard.justNow');
    if (diffMins < 60) return `${diffMins}${this.i18n.t('dev.dashboard.minAgo')}`;
    if (diffHours < 24) return `${diffHours}${this.i18n.t('dev.dashboard.hAgo')}`;
    if (diffDays < 7) return `${diffDays}${this.i18n.t('dev.dashboard.dAgo')}`;
    return date.toLocaleDateString(getDateLocale(this.i18n.language()));
  }
}
