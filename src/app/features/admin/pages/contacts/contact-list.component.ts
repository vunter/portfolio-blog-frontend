import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { I18nService } from '../../../../core/services/i18n.service';
import { getDateLocale } from '../../../../core/utils/date-format.util';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { PageResponse } from '../../../../models/common.model';
import { ContactResponse } from '../../../../models/contact.model';
import { AdminApiService } from '../../services/admin-api.service';

@Component({
  selector: 'app-contact-list',
  imports: [FormsModule],
  templateUrl: './contact-list.component.html',
  styleUrl: './contact-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactListComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private apiService = inject(ApiService);
  private adminApi = inject(AdminApiService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  i18n = inject(I18nService);

  private readonly endpoint = '/admin/contact/messages';
  private readonly pageSize = 20;

  messages = signal<ContactResponse[]>([]);
  loading = signal(true);
  error = signal(false);
  expandedId = signal<string | null>(null);
  // AUD19-B: fresh copy of the opened message (list body may be truncated/stale).
  freshMessage = signal<ContactResponse | null>(null);
  loadingDetail = signal(false);
  detailFetchFailed = signal(false);
  sortAsc = signal(false);
  currentPage = signal(0);
  totalElements = signal(0);
  totalPages = signal(0);

  sortedMessages = signal<ContactResponse[]>([]);
  searchQuery = signal('');
  statusFilter = signal('');
  filteredMessages = computed(() => {
    let list = this.sortedMessages();
    const q = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    if (q) {
      list = list.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.subject?.toLowerCase().includes(q)
      );
    }
    if (status === 'read') list = list.filter(m => m.read);
    if (status === 'unread') list = list.filter(m => !m.read);
    return list;
  });

  ngOnInit(): void {
    this.loadMessages();
  }

  loadMessages(page = 0): void {
    this.loading.set(true);
    this.error.set(false);
    this.apiService.get<PageResponse<ContactResponse>>(this.endpoint, {
      page,
      size: this.pageSize,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.messages.set(response.content);
        this.currentPage.set(response.page);
        this.totalElements.set(response.totalElements);
        this.totalPages.set(response.totalPages);
        this.applySorting();
        this.loading.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('dev.error.loadMessages'));
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.collapseExpanded();
    this.loadMessages(page);
  }

  private collapseExpanded(): void {
    this.expandedId.set(null);
    this.freshMessage.set(null);
    this.detailFetchFailed.set(false);
    this.loadingDetail.set(false);
  }

  private applySorting(): void {
    const sorted = [...this.messages()].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return this.sortAsc() ? dateA - dateB : dateB - dateA;
    });
    this.sortedMessages.set(sorted);
  }

  toggleSortOrder(): void {
    this.sortAsc.update((v) => !v);
    this.applySorting();
  }

  toggleExpand(id: string): void {
    const next = this.expandedId() === id ? null : id;
    this.expandedId.set(next);
    if (next !== null) {
      this.loadFreshMessage(next);
    } else {
      this.freshMessage.set(null);
      this.detailFetchFailed.set(false);
    }
  }

  // AUD19-B: on open, fetch the message fresh via GET /admin/contact/messages/{id}
  // and render from that copy; on failure, fall back to the (possibly stale)
  // list row with a non-blocking inline warning.
  private loadFreshMessage(id: string): void {
    this.loadingDetail.set(true);
    this.detailFetchFailed.set(false);
    this.freshMessage.set(null);

    this.adminApi.getContactMessage(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (fresh) => {
        // Ignore late responses for a row that was collapsed/switched meanwhile.
        if (this.expandedId() !== id) return;
        this.freshMessage.set(fresh);
        this.loadingDetail.set(false);
        // Reconcile the list row with the fresh copy (read flag / body).
        this.messages.update((list) => list.map((m) => (m.id === id ? { ...m, ...fresh } : m)));
        this.applySorting();
      },
      error: () => {
        if (this.expandedId() !== id) return;
        this.loadingDetail.set(false);
        this.detailFetchFailed.set(true);
      },
    });
  }

  markAsRead(msg: ContactResponse): void {
    // AUD19-B: the PUT returns the full updated ContactMessage — reuse it as the
    // fresh copy instead of issuing an extra GET.
    this.adminApi.markMessageAsRead(msg.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.messages.update((list) =>
          list.map((m) => (m.id === msg.id ? { ...m, ...updated, read: true } : m))
        );
        if (this.expandedId() === msg.id) {
          this.freshMessage.set({ ...updated, read: true });
          this.detailFetchFailed.set(false);
        }
        this.applySorting();
        this.notification.success(this.i18n.t('admin.contacts.markedAsRead'));
      },
      error: () => {
        this.notification.error(this.i18n.t('dev.error.markAsRead'));
      },
    });
  }

  async deleteMessage(msg: ContactResponse): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('admin.contacts.delete'),
      message: this.i18n.t('admin.contacts.confirmDelete'),
      confirmText: this.i18n.t('admin.contacts.delete'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;

    this.apiService.delete(`${this.endpoint}/${msg.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (this.expandedId() === msg.id) {
          this.collapseExpanded();
        }
        // Reload current page to keep pagination in sync
        this.loadMessages(this.currentPage());
        this.notification.success(this.i18n.t('admin.contacts.deleted'));
      },
      error: () => {
        this.notification.error(this.i18n.t('dev.error.deleteMessage'));
      },
    });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(
      getDateLocale(this.i18n.language()),
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  }
}
