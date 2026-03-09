import { Component, inject, signal, effect, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { getDateLocale } from '../../../../core/utils/date-format.util';

interface AuditLog {
  id: number;
  action: string;
  entityType: string;
  entityId: string;
  performedBy: number;
  performedByEmail: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

@Component({
  selector: 'app-audit',
  imports: [NgClass, FormsModule, SkeletonComponent],
  templateUrl: './audit.component.html',
  styleUrl: './audit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditComponent {
  private destroyRef = inject(DestroyRef);
  private api = inject(ApiService);
  private notification = inject(NotificationService);
  i18n = inject(I18nService);

  logs = signal<AuditLog[]>([]);
  loading = signal(true);
  days = signal(7);
  limit = signal(50);

  constructor() {
    effect(() => {
      this.days();
      this.limit();
      this.loadLogs();
    });
  }

  loadLogs(): void {
    this.loading.set(true);
    this.api.get<AuditLog[]>('/admin/audit/recent', {
      days: this.days(),
      limit: this.limit(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.logs.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.audit.exportError'));
        this.loading.set(false);
      },
    });
  }

  exportCsv(): void {
    this.api.getText('/admin/audit/export/csv', { days: this.days() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (csv) => {
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          this.downloadBlob(blob, `audit-log-${this.days()}d.csv`);
        },
        error: () => {
          this.notification.error(this.i18n.t('admin.audit.exportError'));
        },
      });
  }

  exportJson(): void {
    this.api.get<AuditLog[]>('/admin/audit/export/json', { days: this.days() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          this.downloadBlob(blob, `audit-log-${this.days()}d.json`);
        },
        error: () => {
          this.notification.error(this.i18n.t('admin.audit.exportError'));
        },
      });
  }

  getActionClass(action: string): string {
    const map: Record<string, string> = {
      CREATE: 'badge--create',
      UPDATE: 'badge--update',
      DELETE: 'badge--delete',
      LOGIN: 'badge--login',
    };
    return map[action] || 'badge--default';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(getDateLocale(this.i18n.language()), {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getDaysLabel(d: number): string {
    return d === 1 ? this.i18n.t('admin.audit.day') : this.i18n.t('admin.audit.days_label');
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
