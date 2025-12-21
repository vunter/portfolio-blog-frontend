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
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  i18n = inject(I18nService);

  private readonly endpoint = '/admin/contact/messages';
  private readonly pageSize = 20;

  messages = signal<ContactResponse[]>([]);
  loading = signal(true);
  error = signal(false);
  expandedId = signal<string | null>(null);
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
        this.notification.error(this.i18n.t('admin.error.loadMessages'));
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.expandedId.set(null);
    this.loadMessages(page);
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
    this.expandedId.update((current) => (current === id ? null : id));
  }

  markAsRead(msg: ContactResponse): void {
    this.apiService.put(`${this.endpoint}/${msg.id}/read`, {}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.messages.update((list) =>
          list.map((m) => (m.id === msg.id ? { ...m, read: true } : m))
        );
        this.applySorting();
        this.notification.success(this.i18n.t('admin.contacts.markedAsRead'));
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.error.markAsRead'));
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
          this.expandedId.set(null);
        }
        // Reload current page to keep pagination in sync
        this.loadMessages(this.currentPage());
        this.notification.success(this.i18n.t('admin.contacts.deleted'));
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.error.deleteMessage'));
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
