import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface OptimizeOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  outputType?: 'image/webp' | 'image/jpeg';
}

const DEFAULTS: Record<string, OptimizeOptions> = {
  cover: { maxWidth: 1200, maxHeight: 630, quality: 0.82, outputType: 'image/webp' },
  content: { maxWidth: 1600, maxHeight: 1200, quality: 0.82, outputType: 'image/webp' },
  avatar: { maxWidth: 400, maxHeight: 400, quality: 0.80, outputType: 'image/webp' },
};

@Injectable({ providedIn: 'root' })
export class ImageOptimizerService {
  private readonly platformId = inject(PLATFORM_ID);

  /**
   * Optimize an image file by resizing and compressing it client-side.
   * Returns the original file unchanged if:
   *  - not running in a browser
   *  - file is not an image
   *  - file is already smaller than the target dimensions and under 200KB
   *  - Canvas API is unavailable
   */
  async optimize(file: File, preset: 'cover' | 'content' | 'avatar' = 'content'): Promise<File> {
    if (!isPlatformBrowser(this.platformId)) return file;
    if (!file.type.startsWith('image/')) return file;

    // SVGs and GIFs should not be re-encoded
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;

    const opts = DEFAULTS[preset];

    try {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;

      // Skip optimization if image is already small enough
      if (width <= opts.maxWidth && height <= opts.maxHeight && file.size <= 200 * 1024) {
        bitmap.close();
        return file;
      }

      const { w, h } = this.fitDimensions(width, height, opts.maxWidth, opts.maxHeight);

      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close();
        return file;
      }

      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();

      // Try WebP first, fall back to JPEG
      let blob = await canvas.convertToBlob({ type: opts.outputType ?? 'image/webp', quality: opts.quality });

      // If WebP output is unexpectedly large or unsupported, try JPEG
      if (blob.size >= file.size && opts.outputType === 'image/webp') {
        blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: opts.quality });
      }

      // If optimized is still larger, return original
      if (blob.size >= file.size) return file;

      const ext = blob.type === 'image/webp' ? '.webp' : '.jpg';
      const baseName = file.name.replace(/\.[^.]+$/, '');
      return new File([blob], baseName + ext, { type: blob.type, lastModified: Date.now() });
    } catch {
      // Canvas/OffscreenCanvas not supported — return original
      return file;
    }
  }

  private fitDimensions(
    srcW: number, srcH: number, maxW: number, maxH: number,
  ): { w: number; h: number } {
    if (srcW <= maxW && srcH <= maxH) return { w: srcW, h: srcH };
    const ratio = Math.min(maxW / srcW, maxH / srcH);
    return { w: Math.round(srcW * ratio), h: Math.round(srcH * ratio) };
  }
}
