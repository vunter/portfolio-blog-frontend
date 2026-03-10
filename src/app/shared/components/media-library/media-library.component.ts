import { Component, DestroyRef, inject, input, output, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminApiService, MediaAssetResponse, MediaPurpose } from '../../../features/admin/services/admin-api.service';
import { I18nService } from '../../../core/services/i18n.service';
import { MediaUploadComponent } from '../media-upload/media-upload.component';
import { DatePipe, NgOptimizedImage } from '@angular/common';

/**
 * Media library browser.
 * Shows a grid of previously uploaded media assets, allows selecting one (for reuse),
 * and includes an upload section for new files.
 *
 * Usage:
 * ```html
 * <app-media-library
 *   [purpose]="'BLOG_COVER'"
 *   (selected)="onMediaSelected($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-media-library',
  standalone: true,
  imports: [MediaUploadComponent, DatePipe, NgOptimizedImage],
  templateUrl: './media-library.component.html',
  styleUrl: './media-library.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaLibraryComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Filter by purpose, or show all */
  purpose = input<MediaPurpose | ''>('');

  /** Emitted when user selects a media asset from the library */
  selected = output<MediaAssetResponse>();

  /** Emitted when user deletes a media asset */
  deleted = output<MediaAssetResponse>();

  assets = signal<MediaAssetResponse[]>([]);
  loading = signal(false);
  totalItems = signal(0);
  currentPage = signal(0);
  selectedAssetId = signal<number | null>(null);
  activeTab = signal<'library' | 'upload'>('library');
  readonly pageSize = 20;

  ngOnInit(): void {
    this.loadAssets();
  }

  loadAssets(): void {
    this.loading.set(true);
    const purpose = this.purpose() || undefined;

    this.adminApi.getMediaAssets(this.currentPage(), this.pageSize, purpose)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (res) => {
        this.assets.set(res.items);
        this.totalItems.set(res.totalItems);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  selectAsset(asset: MediaAssetResponse): void {
    this.selectedAssetId.set(asset.id);
    this.selected.emit(asset);
  }

  deleteAsset(asset: MediaAssetResponse, event: Event): void {
    event.stopPropagation();
    this.adminApi.deleteMediaAsset(String(asset.id))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: () => {
        this.assets.update(list => list.filter(a => a.id !== asset.id));
        this.totalItems.update(n => n - 1);
        if (this.selectedAssetId() === asset.id) {
          this.selectedAssetId.set(null);
        }
        this.deleted.emit(asset);
      },
    });
  }

  onNewUpload(asset: MediaAssetResponse): void {
    // Prepend new upload to the list and auto-select
    this.assets.update(list => [asset, ...list]);
    this.totalItems.update(n => n + 1);
    this.selectAsset(asset);
    this.activeTab.set('library');
  }

  nextPage(): void {
    const totalPages = Math.ceil(this.totalItems() / this.pageSize);
    if (this.currentPage() < totalPages - 1) {
      this.currentPage.update(p => p + 1);
      this.loadAssets();
    }
  }

  prevPage(): void {
    if (this.currentPage() > 0) {
      this.currentPage.update(p => p - 1);
      this.loadAssets();
    }
  }

  setTab(tab: 'library' | 'upload'): void {
    this.activeTab.set(tab);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems() / this.pageSize);
  }
}
