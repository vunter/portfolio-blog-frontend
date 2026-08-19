import { Component, computed, inject, signal, effect, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService, AuditLog } from '../../services/admin-api.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { getDateLocale } from '../../../../core/utils/date-format.util';

// AUD19: audit drill-down filter modes
export type AuditFilterMode = 'recent' | 'user' | 'entity';

// AUD19: backend entityType contract is ^[A-Z_]+$ (AdminAuditController)
const ENTITY_TYPE_PATTERN = /^[A-Z_]+$/;

// AUD19: constants used by backend AuditService.logAction callers
const COMMON_ENTITY_TYPES = ['ARTICLE', 'CACHE', 'DATA', 'SETTINGS', 'USER'];

@Component({
  selector: 'app-audit',
  imports: [NgClass, FormsModule, SkeletonComponent],
  templateUrl: './audit.component.html',
  styleUrl: './audit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditComponent {
  private destroyRef = inject(DestroyRef);
  private adminApi = inject(AdminApiService);
  private notification = inject(NotificationService);
  i18n = inject(I18nService);

  logs = signal<AuditLog[]>([]);
  loading = signal(true);
  days = signal(7);
  limit = signal(50);

  // AUD19: drill-down state
  mode = signal<AuditFilterMode>('recent');
  // AUD19C-02: Snowflake user id kept as string end-to-end (a number input /
  // Number() cast would corrupt ids above 2^53).
  userId = signal<string | null>(null);
  userPage = signal(0);
  userHasNext = signal(false);
  entityType = signal('');
  entityId = signal('');
  /** Whether a drill-down query has been executed for the current mode. */
  searched = signal(false);
  // AUD19: error state with retry, same pattern as article-review-panel (AUD18-05)
  loadError = signal(false);

  /** Page size for the by-user drill-down (backend clamps size <= 100). */
  readonly pageSize = 20;

  // AUD19: entityType values seen in loaded logs, merged with backend constants
  private seenEntityTypes = signal<string[]>([]);
  entityTypeOptions = computed(() => {
    const all = new Set<string>([...COMMON_ENTITY_TYPES, ...this.seenEntityTypes()]);
    return [...all].sort();
  });

  constructor() {
    effect(() => {
      const mode = this.mode();
      this.days();
      this.limit();
      // Recent mode reloads reactively on days/limit change; drill-down
      // modes fetch explicitly (search button, pagination, row click).
      if (mode === 'recent') {
        this.loadLogs();
      }
    });
  }

  setMode(mode: AuditFilterMode): void {
    if (this.mode() === mode) {
      return;
    }
    this.loadError.set(false);
    this.searched.set(false);
    if (mode !== 'recent') {
      this.logs.set([]);
      this.loading.set(false);
    }
    this.mode.set(mode);
  }

  loadLogs(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.adminApi.getRecentAuditLogs(this.days(), this.limit())
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.setLogs(data);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  // AUD19: by-user drill-down (paged, 0-indexed)
  searchByUser(): void {
    const id = this.userId()?.trim() ?? '';
    // AUD19C-02: validate the digit-string without parsing it.
    if (!/^\d+$/.test(id)) {
      this.notification.error(this.i18n.t('admin.audit.invalidUserId'));
      return;
    }
    this.userId.set(id);
    this.userPage.set(0);
    this.fetchUserLogs();
  }

  fetchUserLogs(): void {
    const id = this.userId();
    if (!id) {
      return;
    }
    this.loading.set(true);
    this.loadError.set(false);
    this.adminApi.getAuditLogsByUser(id, this.userPage(), this.pageSize)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.setLogs(data);
        this.userHasNext.set(data.length === this.pageSize);
        this.searched.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  goToUserPage(page: number): void {
    if (page < 0) {
      return;
    }
    this.userPage.set(page);
    this.fetchUserLogs();
  }

  // AUD19: by-entity drill-down; entityType must match ^[A-Z_]+$
  searchByEntity(): void {
    const type = this.entityType().trim().toUpperCase();
    const id = this.entityId().trim();
    if (!ENTITY_TYPE_PATTERN.test(type)) {
      this.notification.error(this.i18n.t('admin.audit.invalidEntityType'));
      return;
    }
    if (!id) {
      this.notification.error(this.i18n.t('admin.audit.invalidEntityId'));
      return;
    }
    this.entityType.set(type);
    this.entityId.set(id);
    this.fetchEntityLogs();
  }

  fetchEntityLogs(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.adminApi.getAuditLogsByEntity(this.entityType(), this.entityId())
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.setLogs(data);
        this.searched.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  // AUD19: drill-down gestures from log rows
  // AUD19C-02: performedBy is a Snowflake string and flows through unchanged.
  drillToUser(log: AuditLog): void {
    if (!log.performedBy) {
      return;
    }
    this.setMode('user');
    this.userId.set(log.performedBy);
    this.userPage.set(0);
    this.fetchUserLogs();
  }

  drillToEntity(log: AuditLog): void {
    if (!this.canDrillToEntity(log)) {
      return;
    }
    this.setMode('entity');
    this.entityType.set(log.entityType);
    this.entityId.set(log.entityId);
    this.fetchEntityLogs();
  }

  canDrillToEntity(log: AuditLog): boolean {
    return !!log.entityId && ENTITY_TYPE_PATTERN.test(log.entityType ?? '');
  }

  retry(): void {
    switch (this.mode()) {
      case 'recent':
        this.loadLogs();
        break;
      case 'user':
        this.fetchUserLogs();
        break;
      case 'entity':
        this.fetchEntityLogs();
        break;
    }
  }

  exportCsv(): void {
    this.adminApi.exportAuditCsv(this.days())
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
    this.adminApi.exportAuditJson(this.days())
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

  private setLogs(data: AuditLog[]): void {
    this.logs.set(data);
    const seen = new Set(this.seenEntityTypes());
    let changed = false;
    for (const log of data) {
      if (log.entityType && ENTITY_TYPE_PATTERN.test(log.entityType) && !seen.has(log.entityType)) {
        seen.add(log.entityType);
        changed = true;
      }
    }
    if (changed) {
      this.seenEntityTypes.set([...seen]);
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
