import { Component, inject, signal, OnInit, ChangeDetectionStrategy, DestroyRef, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { getDateLocale } from '../../../../core/utils/date-format.util';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { UserResponse, PageResponse } from '../../../../models';

@Component({
  selector: 'app-user-list',
  imports: [FormsModule, PaginationComponent],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private apiService = inject(ApiService);
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
          this.notification.error(this.i18n.t('admin.error.loadUsers'));
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
    this.apiService.put(`/admin/users/${user.id}/${action}`, {}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(user.active ? this.i18n.t('admin.users.deactivated') : this.i18n.t('admin.users.activated'));
        this.loadUsers();
      },
      error: () => {
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

    this.apiService.delete(`/admin/users/${user.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('admin.users.deleteSuccess'));
        this.loadUsers();
      },
      error: (err) => {
        this.notification.error(this.i18n.t('admin.users.deleteError'));
      },
    });
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      ADMIN: this.i18n.t('admin.users.admin'),
      DEV: this.i18n.t('admin.users.dev'),
      EDITOR: this.i18n.t('admin.users.editor'),
      VIEWER: this.i18n.t('admin.users.viewer'),
    };
    return labels[role] || role;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(getDateLocale(this.i18n.language()));
  }
}
