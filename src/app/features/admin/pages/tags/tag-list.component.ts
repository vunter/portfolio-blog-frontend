// TODO F-391: Let backend generate slugs exclusively to prevent inconsistency
import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { TagResponse } from '../../../../models';

@Component({
  selector: 'app-tag-list',
  imports: [FormsModule],
  templateUrl: './tag-list.component.html',
  styleUrl: './tag-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagListComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private apiService = inject(ApiService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  i18n = inject(I18nService);

  tags = signal<TagResponse[]>([]);
  loading = signal(true);
  error = signal(false);
  searchQuery = signal('');
  filteredTags = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.tags();
    return this.tags().filter(t =>
      t.name?.toLowerCase().includes(q) ||
      t.slug?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q)
    );
  });
  showModal = signal(false);
  editingTag = signal<TagResponse | null>(null);
  saving = signal(false);

  formData = {
    name: '',
    slug: '',
    description: '',
    color: '#6366f1',
  };

  ngOnInit(): void {
    this.loadTags();
  }

  loadTags(): void {
    this.error.set(false);
    this.apiService.get<TagResponse[]>('/admin/tags').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (tags) => {
        this.tags.set(tags);
        this.loading.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.error.loadTags'));
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  openModal(): void {
    this.formData = { name: '', slug: '', description: '', color: '#6366f1' };
    this.editingTag.set(null);
    this.showModal.set(true);
  }

  editTag(tag: TagResponse): void {
    this.formData = {
      name: tag.name,
      slug: tag.slug,
      description: tag.description || '',
      color: tag.color || '#6366f1',
    };
    this.editingTag.set(tag);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingTag.set(null);
  }

  onNameChange(name: string): void {
    // Auto-generate slug from name only for new tags (not editing)
    if (!this.editingTag()) {
      this.formData.slug = this.generateSlug(name);
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  saveTag(): void {
    if (!this.formData.name) return;
    // Ensure slug is generated if still empty
    if (!this.formData.slug) {
      this.formData.slug = this.generateSlug(this.formData.name);
    }

    this.saving.set(true);
    const request = this.editingTag()
      ? this.apiService.put(`/admin/tags/${this.editingTag()!.id}`, this.formData)
      : this.apiService.post('/admin/tags', this.formData);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.editingTag() ? this.i18n.t('admin.tags.updateSuccess') : this.i18n.t('admin.tags.createSuccess'));
        this.closeModal();
        this.loadTags();
        this.saving.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.tags.saveError'));
        this.saving.set(false);
      },
    });
  }

  async deleteTag(tag: TagResponse): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('common.delete'),
      message: this.i18n.t('admin.tags.confirmDelete').replace('{{name}}', tag.name),
      confirmText: this.i18n.t('common.delete'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;

    this.apiService.delete(`/admin/tags/${tag.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('admin.tags.deleteSuccess'));
        this.loadTags();
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.tags.deleteError'));
      },
    });
  }
}
