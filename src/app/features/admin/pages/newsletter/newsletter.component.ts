import { Component, inject, signal, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ApiService } from '../../../../core/services/api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { DownloadService } from '../../../../core/services/download.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { NewsletterSubscriber, PageResponse } from '../../../../models';
import { environment } from '../../../../../environments/environment';
import { getDateLocale } from '../../../../core/utils/date-format.util';

@Component({
  selector: 'app-newsletter',
  imports: [FormsModule, PaginationComponent],
  templateUrl: './newsletter.component.html',
  styleUrl: './newsletter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsletterComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private apiService = inject(ApiService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  private downloadService = inject(DownloadService);
  i18n = inject(I18nService);

  private searchSubject = new Subject<string>();

  subscribers = signal<NewsletterSubscriber[]>([]);
  loading = signal(true);
  error = signal(false);
  selectedIds = signal<string[]>([]);
  searchTerm = '';
  statusFilter = '';

  currentPage = signal(0);
  pageSize = signal(20);
  totalPages = signal(0);
  totalElements = signal(0);

  totalSubscribers = signal(0);
  activeSubscribers = signal(0);
  newThisMonth = signal(0);

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.currentPage.set(0);
      this.loadSubscribers();
    });
    this.loadStats();
    this.loadSubscribers();
  }

  loadStats(): void {
    this.apiService.get<{ total: number; active: number; newThisMonth: number }>(
      '/admin/newsletter/stats'
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (stats) => {
        this.totalSubscribers.set(stats.total ?? 0);
        this.activeSubscribers.set(stats.active ?? 0);
        this.newThisMonth.set(stats.newThisMonth ?? 0);
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.error.loadNewsletter'));
      },
    });
  }

  loadSubscribers(): void {
    this.error.set(false);
    const params: Record<string, string> = {
      page: this.currentPage().toString(),
      size: this.pageSize().toString(),
    };
    if (this.searchTerm) params['email'] = this.searchTerm;
    if (this.statusFilter) params['status'] = this.statusFilter;

    this.apiService.get<PageResponse<NewsletterSubscriber>>(
      '/admin/newsletter/subscribers',
      params
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.subscribers.set(response.content);
        this.totalPages.set(response.totalPages);
        this.totalElements.set(response.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.error.loadNewsletter'));
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  onSearch(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadSubscribers();
  }

  isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  allSelected(): boolean {
    return (
      this.subscribers().length > 0 &&
      this.subscribers().every((s) => this.selectedIds().includes(s.id))
    );
  }

  toggleSelect(id: string): void {
    this.selectedIds.update((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]
    );
  }

  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedIds.set([]);
    } else {
      this.selectedIds.set(this.subscribers().map((s) => s.id));
    }
  }

  async deleteSubscriber(subscriber: NewsletterSubscriber): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('common.delete'),
      message: this.i18n.t('admin.newsletter.confirmRemove').replace('{{email}}', subscriber.email),
      confirmText: this.i18n.t('common.delete'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;

    this.apiService.delete(`/admin/newsletter/subscribers/${subscriber.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('admin.newsletter.removeSuccess'));
        this.loadSubscribers();
        this.loadStats();
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.newsletter.removeError'));
      },
    });
  }

  async deleteSelected(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('common.delete'),
      message: this.i18n.t('admin.newsletter.confirmRemoveBulk').replace('{{count}}', String(this.selectedIds().length)),
      confirmText: this.i18n.t('common.delete'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;

    this.apiService.post('/admin/newsletter/subscribers/delete-batch', {
      ids: this.selectedIds(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('admin.newsletter.removeBulkSuccess'));
        this.selectedIds.set([]);
        this.loadSubscribers();
        this.loadStats();
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.newsletter.removeBulkError'));
      },
    });
  }

  exportSubscribers(): void {
    this.apiService.getText('/admin/newsletter/export').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data: string) => {
        const filename = `newsletter-subscribers-${new Date().toISOString().split('T')[0]}.csv`;
        this.downloadService.downloadText(data, filename, 'text/csv');
        this.notification.success(this.i18n.t('admin.newsletter.exportSuccess'));
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.newsletter.exportError'));
      },
    });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(getDateLocale(this.i18n.language()));
  }
}
