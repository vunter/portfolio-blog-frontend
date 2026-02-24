import { Component, inject, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AdminApiService, MediaAssetResponse, MediaPurpose } from '../../../features/admin/services/admin-api.service';
import { I18nService } from '../../../core/services/i18n.service';

/**
 * Reusable media upload component.
 * Supports file selection, drag-and-drop, upload progress, and preview.
 * Can be used for avatars, blog covers, blog content images, comment images, etc.
 *
 * Usage:
 * ```html
 * <app-media-upload
 *   [purpose]="'BLOG_COVER'"
 *   [imageUrlControl]="form.controls.coverImageUrl"
 *   (uploaded)="onImageUploaded($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-media-upload',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './media-upload.component.html',
  styleUrl: './media-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaUploadComponent {
  private readonly adminApi = inject(AdminApiService);
  readonly i18n = inject(I18nService);

  /** The purpose/context of the upload */
  purpose = input<MediaPurpose>('GENERAL');

  /** Optional FormControl to bind the resulting URL */
  imageUrlControl = input<FormControl<string>>();

  /** Whether to show the URL text input (default: true) */
  showUrlInput = input<boolean>(true);

  /** Whether to show the image preview (default: true) */
  showPreview = input<boolean>(true);

  /** Accepted file types */
  accept = input<string>('image/jpeg,image/png,image/gif,image/webp');

  /** Placeholder text when no image is set */
  placeholder = input<string>('');

  /** Emitted when a file is successfully uploaded */
  uploaded = output<MediaAssetResponse>();

  /** Emitted when upload fails */
  uploadError = output<string>();

  uploading = signal(false);
  dragOver = signal(false);

  get previewUrl(): string {
    return this.imageUrlControl()?.value || '';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    this.uploadFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);

    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    // Validate file type
    const acceptedTypes = this.accept().split(',').map(t => t.trim());
    if (!acceptedTypes.includes(file.type)) {
      this.uploadError.emit('Invalid file type');
      return;
    }

    this.uploadFile(file);
  }

  private uploadFile(file: File): void {
    this.uploading.set(true);

    this.adminApi.uploadMedia(file, this.purpose()).subscribe({
      next: (asset) => {
        this.uploading.set(false);
        // Update the form control if provided
        const ctrl = this.imageUrlControl();
        if (ctrl) {
          ctrl.setValue(asset.url);
        }
        this.uploaded.emit(asset);
      },
      error: (err) => {
        this.uploading.set(false);
        const message = err?.error?.message || err?.message || 'Upload failed';
        this.uploadError.emit(message);
      },
    });
  }
}
