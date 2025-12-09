import { Component, input, output, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-pagination',
  imports: [],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationComponent {
  i18n = inject(I18nService);

  // Primary interface - direct totalPages
  currentPage = input<number>(0);
  totalPages = input<number>(0);

  // Alternative interface - calculate from totalElements and pageSize
  totalElements = input<number>(0);
  pageSize = input<number>(10);

  maxVisiblePages = input<number>(5);
  pageChange = output<number>();

  // Compute total pages from either direct value or calculated
  computedTotalPages = computed(() => {
    const direct = this.totalPages();
    if (direct > 0) return direct;
    const elements = this.totalElements();
    const size = this.pageSize();
    return size > 0 ? Math.ceil(elements / size) : 0;
  });

  visiblePages = computed(() => {
    const total = this.computedTotalPages();
    const current = this.currentPage();
    const max = this.maxVisiblePages();

    if (total <= max) {
      return Array.from({ length: total }, (_, i) => i);
    }

    const half = Math.floor(max / 2);
    let start = current - half;
    let end = current + half;

    if (start < 0) {
      start = 0;
      end = max - 1;
    }

    if (end >= total) {
      end = total - 1;
      start = total - max;
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });

  goToPage(page: number): void {
    const total = this.computedTotalPages();
    if (page >= 0 && page < total && page !== this.currentPage()) {
      this.pageChange.emit(page);
    }
  }
}
