import { Component, inject, signal, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { getDateLocale } from '../../../../core/utils/date-format.util';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { AccessibleModalDirective } from '../../../../shared/directives/accessible-modal.directive';
import { UserResponse, PageResponse } from '../../../../models';
import { AdminApiService, UserActivity } from '../../services/admin-api.service';

@Component({
  selector: 'app-user-list',
  imports: [FormsModule, PaginationComponent, SkeletonComponent, AccessibleModalDirective],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private apiService = inject(ApiService);
  private adminApi = inject(AdminApiService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  i18n = inject(I18nService);

  users = signal<UserResponse[]>([]);
  loading = signal(true);
  error = signal(false);
  searchQuery = signal('');
  private searchSubject = new Subject<string>();
  showModal = signal(false);
  editingUser = signal<UserResponse | null>(null);
  saving = signal(false);
  currentPage = signal(0);
  pageSize = signal(10);
  totalPages = signal(0);
  totalElements = signal(0);

  // User activity modal (F-140), extended into a detail view (AUD19-B):
  // the profile and activity sections load and fail independently.
  selectedUserActivity = signal<UserActivity | null>(null);
  showActivityModal = signal(false);
  loadingActivity = signal(false);
  activityError = signal(false);
  selectedUserDetail = signal<UserResponse | null>(null);
  loadingDetail = signal(false);
  detailError = signal(false);

  formData = {
    name: '',
    email: '',
    password: '',
    role: 'VIEWER' as string,
  };

  constructor() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(query => {
      this.searchQuery.set(query);
      this.currentPage.set(0);
      this.loadUsers();
    });
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  loadUsers(): void {
    this.error.set(false);
    const params: Record<string, string> = {
      page: this.currentPage().toString(),
      size: this.pageSize().toString(),
    };
    const q = this.searchQuery().trim();
    if (q) {
      params['search'] = q;
    }
    this.apiService
      .get<PageResponse<UserResponse>>('/admin/users', params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.users.set(response.content);
          this.totalPages.set(response.totalPages);
          this.totalElements.set(response.totalElements);
          this.loading.set(false);
        },
        error: () => {
          this.notification.error(this.i18n.t('dev.error.loadUsers'));
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  openModal(): void {
    this.formData = { name: '', email: '', password: '', role: 'VIEWER' };
    this.editingUser.set(null);
    this.showModal.set(true);
  }

  editUser(user: UserResponse): void {
    this.formData = {
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    };
    this.editingUser.set(user);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingUser.set(null);
  }

  saveUser(): void {
    const isCreate = !this.editingUser();

    // Required-field validation — the form's native validity is not checked on submit,
    // so guard here before hitting the API.
    if (!this.formData.name?.trim() || !this.formData.email?.trim()) {
      this.notification.error(this.i18n.t('admin.users.requiredFields'));
      return;
    }

    // Q7.4: Enforce password complexity for new user creation. Runs even when the
    // password is empty (empty fails the length check) so an empty password can't
    // slip through to a POST { password: '' }.
    if (isCreate) {
      const pw = this.formData.password || '';
      const hasUpper = /[A-Z]/.test(pw);
      const hasLower = /[a-z]/.test(pw);
      const hasDigit = /[0-9]/.test(pw);
      const hasSpecial = /[^A-Za-z0-9]/.test(pw);
      if (pw.length < 12 || !hasUpper || !hasLower || !hasDigit || !hasSpecial) {
        this.notification.error(this.i18n.t('admin.users.passwordComplexity'));
        return;
      }
    }

    this.saving.set(true);
    const data = this.editingUser()
      ? { name: this.formData.name, email: this.formData.email, role: this.formData.role }
      : this.formData;

    const request = this.editingUser()
      ? this.apiService.put(`/admin/users/${this.editingUser()!.id}`, data)
      : this.apiService.post('/admin/users', data);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.editingUser() ? this.i18n.t('admin.users.updateSuccess') : this.i18n.t('admin.users.createSuccess'));
        this.closeModal();
        this.loadUsers();
        this.saving.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.users.saveError'));
        this.saving.set(false);
      },
    });
  }

  async toggleUserStatus(user: UserResponse): Promise<void> {
    const action = user.active ? 'deactivate' : 'activate';
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t(user.active ? 'admin.users.confirmDeactivate' : 'admin.users.confirmActivate'),
      message: this.i18n.t(user.active ? 'admin.users.confirmDeactivateMessage' : 'admin.users.confirmActivateMessage'),
      confirmText: this.i18n.t('common.confirm'),
      cancelText: this.i18n.t('common.cancel'),
      type: user.active ? 'danger' : 'warning',
    });
    if (!confirmed) return;
    const snapshot = this.users();
    this.users.update(list =>
      list.map(u => u.id === user.id ? { ...u, active: !user.active } : u)
    );

    this.apiService.put(`/admin/users/${user.id}/${action}`, {}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        // Q7.7: Undo toast for destructive user status toggle
        this.notification.successWithUndo(
          user.active ? this.i18n.t('admin.users.deactivated') : this.i18n.t('admin.users.activated'),
          () => {
            const reverseAction = user.active ? 'activate' : 'deactivate';
            this.apiService.put(`/admin/users/${user.id}/${reverseAction}`, {}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
              next: () => this.loadUsers(),
              error: () => this.notification.error(this.i18n.t('admin.users.toggleError')),
            });
          }
        );
      },
      error: () => {
        this.users.set(snapshot);
        this.notification.error(this.i18n.t('admin.users.toggleError'));
      },
    });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadUsers();
  }

  async deleteUser(user: UserResponse): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('common.delete'),
      message: this.i18n.t('admin.users.confirmDelete', { name: user.name }),
      confirmText: this.i18n.t('common.delete'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;

    const snapshot = this.users();
    this.users.update(list => list.filter(u => u.id !== user.id));

    this.apiService.delete(`/admin/users/${user.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('admin.users.deleteSuccess'));
        // Refresh totals/pagination (the optimistic removal alone leaves the pager
        // stale). Step back a page if this emptied the last page.
        if (this.users().length === 0 && this.currentPage() > 0) {
          this.currentPage.set(this.currentPage() - 1);
        }
        this.loadUsers();
      },
      error: () => {
        this.users.set(snapshot);
        this.notification.error(this.i18n.t('admin.users.deleteError'));
      },
    });
  }

  viewActivity(userId: string): void {
    this.loadingActivity.set(true);
    this.loadingDetail.set(true);
    this.showActivityModal.set(true);
    this.selectedUserActivity.set(null);
    this.selectedUserDetail.set(null);
    this.activityError.set(false);
    this.detailError.set(false);

    this.apiService
      .get<UserActivity>(`/admin/users/${userId}/activity`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (activity) => {
          this.selectedUserActivity.set(activity);
          this.loadingActivity.set(false);
        },
        error: () => {
          // AUD19-B: per-section error — the profile section may still succeed,
          // so keep the modal open instead of tearing it down.
          this.activityError.set(true);
          this.loadingActivity.set(false);
        },
      });

    // AUD19-B: fresh profile fetch, independent of the activity call.
    // AUD19C-02: userId is a Snowflake string — pass it through untouched.
    this.adminApi
      .getUserById(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.selectedUserDetail.set(user);
          this.loadingDetail.set(false);
        },
        error: () => {
          this.detailError.set(true);
          this.loadingDetail.set(false);
        },
      });
  }

  closeActivityModal(): void {
    this.showActivityModal.set(false);
    this.selectedUserActivity.set(null);
    this.selectedUserDetail.set(null);
    this.activityError.set(false);
    this.detailError.set(false);
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      ADMIN: this.i18n.t('admin.users.admin'),
      DEV: this.i18n.t('admin.users.dev'),
      VIEWER: this.i18n.t('admin.users.viewer'),
    };
    return labels[role] || role;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(getDateLocale(this.i18n.language()));
  }
}
