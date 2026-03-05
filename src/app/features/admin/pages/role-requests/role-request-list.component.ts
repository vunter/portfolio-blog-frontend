import { Component, inject, signal, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../../../core/services/api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { getDateLocale } from '../../../../core/utils/date-format.util';
import { RoleUpgradeRequestResponse } from '../../../../models';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-role-request-list',
  imports: [SkeletonComponent],
  templateUrl: './role-request-list.component.html',
  styleUrl: './role-request-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleRequestListComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private apiService = inject(ApiService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  i18n = inject(I18nService);

  requests = signal<RoleUpgradeRequestResponse[]>([]);
  loading = signal(true);
  error = signal(false);

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.error.set(false);
    this.loading.set(true);
    this.apiService
      .get<RoleUpgradeRequestResponse[]>('/admin/users/role-requests')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.requests.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.notification.error(this.i18n.t('admin.roleRequests.loadError'));
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  async approve(req: RoleUpgradeRequestResponse): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('admin.roleRequests.confirmApprove'),
      message: this.i18n.t('admin.roleRequests.confirmApproveMessage', {
        name: req.userName || req.userEmail || req.userId,
        role: req.requestedRole,
      }),
      confirmText: this.i18n.t('admin.roleRequests.approve'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'warning',
    });
    if (!confirmed) return;

    const snapshot = this.requests();
    this.requests.update(list => list.filter(r => r.id !== req.id));

    this.apiService
      .put<RoleUpgradeRequestResponse>(`/admin/users/role-requests/${req.id}/approve`, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notification.success(this.i18n.t('admin.roleRequests.approved'));
        },
        error: () => {
          this.requests.set(snapshot);
          this.notification.error(this.i18n.t('admin.roleRequests.approveError'));
        },
      });
  }

  async reject(req: RoleUpgradeRequestResponse): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('admin.roleRequests.confirmReject'),
      message: this.i18n.t('admin.roleRequests.confirmRejectMessage', {
        name: req.userName || req.userEmail || req.userId,
      }),
      confirmText: this.i18n.t('admin.roleRequests.reject'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;

    const snapshot = this.requests();
    this.requests.update(list => list.filter(r => r.id !== req.id));

    this.apiService
      .put<RoleUpgradeRequestResponse>(`/admin/users/role-requests/${req.id}/reject`, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notification.success(this.i18n.t('admin.roleRequests.rejected'));
        },
        error: () => {
          this.requests.set(snapshot);
          this.notification.error(this.i18n.t('admin.roleRequests.rejectError'));
        },
      });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(getDateLocale(this.i18n.language()));
  }
}
