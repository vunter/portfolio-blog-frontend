import { Pipe, PipeTransform } from '@angular/core';

/**
 * Returns a readable text color (near-black or white) for a given tag background,
 * chosen by perceived luminance. Tag colors are admin/DB-supplied with no contrast
 * guarantee, so hardcoded white text was illegible on light tags — this keeps the
 * label readable on any background.
 */
@Pipe({ name: 'tagTextColor', standalone: true })
export class TagTextColorPipe implements PipeTransform {
  transform(bg: string | null | undefined): string {
    const raw = (bg || '#6366f1').trim().replace('#', '');
    const hex = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) {
      return '#ffffff';
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    // Perceived (sRGB-weighted) luminance in [0,1]. Light backgrounds get dark text.
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#0f172a' : '#ffffff';
  }
}
